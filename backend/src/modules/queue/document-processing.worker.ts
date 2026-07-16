import { UnrecoverableError, Worker, type Job } from 'bullmq';
import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';
import type { DocumentsRepository } from '../documents';
import { DocumentProcessingStatus } from '../documents';
import type { StorageService } from '../storage';
import type { OcrService } from '../ocr';
import { AiPermanentError, type AiService } from '../ai';
import type { ValidationService } from '../validation';
import type { PdfSplitService } from '../upload/pdf-split.service';
import { JobName, QueueName } from './queue.constants';
import { buildRedisConnection } from './redis-connection';
import type {
  DocumentProcessingJobPayload,
  ProcessDocumentJobPayload,
  SplitUploadJobPayload,
} from './queue.types';

/**
 * Responsibility: Consume PROCESS_DOCUMENT jobs from DocumentProcessingQueue.
 *
 * Workflow:
 * Upload → Queue → Worker → OCR → AI → Validation → WAITING_FOR_REVIEW
 *
 * Edit/Approve are manual HTTP APIs. Unexpected errors retry via BullMQ;
 * exhausted retries mark document FAILED.
 *
 * Lock / stall tuning follows BullMQ docs for long-running OCR + AI jobs:
 * https://docs.bullmq.io/guide/workers/stalled-jobs
 */
export class DocumentProcessingWorker {
  private worker: Worker<DocumentProcessingJobPayload> | undefined;
  private running = false;

  public constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly documentsRepository: DocumentsRepository,
    private readonly storageService: StorageService,
    private readonly ocrService: OcrService,
    private readonly aiService: AiService,
    private readonly validationService: ValidationService,
    private readonly pdfSplitService: PdfSplitService,
  ) {}

  /**
   * Starts the BullMQ worker and begins consuming jobs.
   */
  public start(): void {
    if (this.worker) {
      return;
    }

    const { concurrency, lockDurationMs, stalledIntervalMs, maxStalledCount } =
      this.config.queue;

    this.worker = new Worker<DocumentProcessingJobPayload>(
      QueueName.DOCUMENT_PROCESSING,
      async (job) => this.processJob(job),
      {
        connection: buildRedisConnection(this.config),
        prefix: this.config.queue.prefix,
        concurrency,
        lockDuration: lockDurationMs,
        stalledInterval: stalledIntervalMs,
        maxStalledCount,
      },
    );

    this.worker.on('ready', () => {
      this.running = true;
      this.logger.info('DocumentProcessingWorker ready', {
        queue: QueueName.DOCUMENT_PROCESSING,
        concurrency,
        lockDurationMs,
        stalledIntervalMs,
        maxStalledCount,
      });
    });

    this.worker.on('completed', (job) => {
      this.logger.info('Job completed', {
        jobId: job.id,
        jobName: job.name,
        documentId: 'documentId' in job.data ? job.data.documentId : undefined,
        parentUploadId: 'parentUploadId' in job.data ? job.data.parentUploadId : undefined,
        userId: job.data.userId,
        attempt: job.attemptsMade,
      });
    });

    this.worker.on('failed', (job, error) => {
      void this.handleJobFailed(job, error);
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.warn('Job stalled — will retry if under maxStalledCount', {
        jobId,
        maxStalledCount: this.config.queue.maxStalledCount,
      });
    });

    this.worker.on('error', (error) => {
      this.logger.error('DocumentProcessingWorker error', {
        error: error.message,
      });
    });

    this.logger.info('DocumentProcessingWorker started', {
      queue: QueueName.DOCUMENT_PROCESSING,
    });
  }

  /**
   * Returns true when the worker has signaled ready.
   */
  public isRunning(): boolean {
    return this.running && this.worker !== undefined;
  }

  /**
   * Gracefully stops accepting jobs and closes the worker.
   */
  public async stop(): Promise<void> {
    if (!this.worker) {
      return;
    }

    await this.worker.close();
    this.worker = undefined;
    this.running = false;
    this.logger.info('DocumentProcessingWorker stopped');
  }

  private async processJob(job: Job<DocumentProcessingJobPayload>): Promise<void> {
    if (job.name === JobName.SPLIT_UPLOAD) {
      await this.processSplitJob(job as Job<SplitUploadJobPayload>);
      return;
    }

    await this.processDocumentJob(job as Job<ProcessDocumentJobPayload>);
  }

  private async processSplitJob(job: Job<SplitUploadJobPayload>): Promise<void> {
    const startedAt = Date.now();
    const { parentUploadId, userId } = job.data;
    const workerId = process.pid;

    this.logger.info('Split job started', {
      jobId: job.id,
      parentUploadId,
      userId,
      attempt: job.attemptsMade + 1,
      workerId,
    });

    const parent = await this.documentsRepository.findById(parentUploadId);

    if (!parent) {
      throw new UnrecoverableError(`Parent upload not found: ${parentUploadId}`);
    }

    if (parent.processingStatus === DocumentProcessingStatus.SPLIT_COMPLETE) {
      this.logger.info('Split job skipped — parent already split', {
        jobId: job.id,
        parentUploadId,
      });
      return;
    }

    await this.documentsRepository.updateStatus(parentUploadId, {
      processingStatus: DocumentProcessingStatus.SPLITTING,
      jobId: job.id,
      failureReason: null,
    });
    await this.heartbeat(job, 10);

    const result = await this.pdfSplitService.splitAndEnqueue(parentUploadId);
    await this.heartbeat(job, 100);

    this.logger.info('Split job finished', {
      jobId: job.id,
      parentUploadId,
      userId,
      created: result.created,
      failed: result.failed,
      executionTimeMs: Date.now() - startedAt,
      workerId,
    });
  }

  private async processDocumentJob(job: Job<ProcessDocumentJobPayload>): Promise<void> {
    const startedAt = Date.now();
    const { documentId, userId } = job.data;
    const workerId = process.pid;

    this.logger.info('Job started', {
      jobId: job.id,
      documentId,
      userId,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
      workerId,
    });

    const document = await this.documentsRepository.findById(documentId);

    if (!document) {
      throw new UnrecoverableError(`Document not found: ${documentId}`);
    }

    if (document.isUploadContainer) {
      this.logger.info('Job skipped — upload container documents are not processed', {
        jobId: job.id,
        documentId,
      });
      return;
    }

    // Idempotent: terminal / review-ready docs must not be re-processed after a stall recovery.
    if (
      document.processingStatus === DocumentProcessingStatus.WAITING_FOR_REVIEW ||
      document.processingStatus === DocumentProcessingStatus.APPROVED
    ) {
      this.logger.info('Job skipped — document already past pipeline', {
        jobId: job.id,
        documentId,
        processingStatus: document.processingStatus,
      });
      return;
    }

    await this.documentsRepository.updateStatus(documentId, {
      processingStatus: DocumentProcessingStatus.PROCESSING,
      jobId: job.id,
      failureReason: null,
    });
    await this.heartbeat(job, 10);

    await this.documentsRepository.updateStatus(documentId, {
      processingStatus: DocumentProcessingStatus.OCR_PROCESSING,
      jobId: job.id,
    });

    let fileBuffer: Buffer;

    try {
      fileBuffer = await this.storageService.read(document.storagePath);
    } catch (error) {
      throw new UnrecoverableError(
        `Unable to read stored file: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    const ocrResult = await this.ocrService.extract({
      documentId,
      mimeType: document.mimeType,
      fileBuffer,
      originalFileName: document.originalFileName,
    });
    await this.heartbeat(job, 40);

    await this.documentsRepository.saveOcrResult(
      documentId,
      {
        text: ocrResult.text,
        method: ocrResult.method,
        confidence: ocrResult.confidence,
        durationMs: ocrResult.durationMs,
        pageCount: ocrResult.pageCount,
        qualityScore: ocrResult.qualityScore,
        fallbackTriggered: ocrResult.fallbackTriggered,
        completedAt: new Date(),
      },
      DocumentProcessingStatus.OCR_COMPLETED,
    );

    this.logger.info('Job OCR step finished', {
      jobId: job.id,
      documentId,
      userId,
      processingStatus: DocumentProcessingStatus.OCR_COMPLETED,
      ocrMethod: ocrResult.method,
      workerId,
    });

    await this.documentsRepository.updateStatus(documentId, {
      processingStatus: DocumentProcessingStatus.AI_PROCESSING,
      jobId: job.id,
    });
    await this.heartbeat(job, 50);

    let aiResult;
    try {
      const imageFromOcr = ocrResult.pageImage;
      const imageMime =
        document.mimeType === 'image/png' || document.mimeType === 'image/jpeg'
          ? (document.mimeType as 'image/png' | 'image/jpeg')
          : undefined;

      aiResult = await this.aiService.processOcrText(ocrResult.text, {
        documentId,
        workerId,
        ocrMethod: ocrResult.method,
        ocrConfidence: ocrResult.confidence,
        mimeType: document.mimeType,
        image:
          imageFromOcr ??
          (imageMime ? { mimeType: imageMime, buffer: fileBuffer } : undefined),
      });
    } catch (error) {
      if (error instanceof AiPermanentError) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
    await this.heartbeat(job, 80);

    const aiCompletedAt = new Date();

    await this.documentsRepository.saveAiResult(
      documentId,
      {
        classification: {
          documentType: aiResult.classification.documentType,
          confidence: aiResult.classification.confidence,
          reasoningSummary: aiResult.classification.reasoningSummary,
          provider: aiResult.classification.provider,
          model: aiResult.classification.model,
          durationMs: aiResult.classification.durationMs,
          promptTokens: aiResult.classification.promptTokens,
          completionTokens: aiResult.classification.completionTokens,
          rawResponse: aiResult.classification.rawResponse,
          completedAt: aiCompletedAt,
        },
        vendor: {
          name: aiResult.vendor.vendor,
          confidence: aiResult.vendor.confidence,
          provider: aiResult.vendor.provider,
          model: aiResult.vendor.model,
          durationMs: aiResult.vendor.durationMs,
          promptTokens: aiResult.vendor.promptTokens,
          completionTokens: aiResult.vendor.completionTokens,
          rawResponse: aiResult.vendor.rawResponse,
          completedAt: aiCompletedAt,
        },
        extraction: {
          documentType: aiResult.extraction.documentType,
          vendor: aiResult.extraction.vendor,
          fields: aiResult.extraction.fields,
          confidenceScore: aiResult.extraction.confidenceScore,
          provider: aiResult.extraction.provider,
          model: aiResult.extraction.model,
          durationMs: aiResult.extraction.durationMs,
          totalProcessingTimeMs: aiResult.totalDurationMs,
          promptTokens: aiResult.extraction.promptTokens,
          completionTokens: aiResult.extraction.completionTokens,
          rawResponse: aiResult.extraction.rawResponse,
          completedAt: aiCompletedAt,
        },
      },
      DocumentProcessingStatus.AI_COMPLETED,
    );

    this.logger.info('Job AI step finished', {
      jobId: job.id,
      documentId,
      userId,
      processingStatus: DocumentProcessingStatus.AI_COMPLETED,
      documentType: aiResult.classification.documentType,
      vendor: aiResult.vendor.vendor,
      provider: aiResult.provider,
      model: aiResult.model,
      aiDurationMs: aiResult.totalDurationMs,
      workerId,
    });

    await this.documentsRepository.updateStatus(documentId, {
      processingStatus: DocumentProcessingStatus.VALIDATING,
      jobId: job.id,
    });
    await this.heartbeat(job, 90);

    let validationResult;
    try {
      validationResult = await this.validationService.validate(
        {
          documentId,
          documentType: aiResult.extraction.documentType,
          vendor: aiResult.extraction.vendor,
          fields: aiResult.extraction.fields,
        },
        { workerId },
      );
    } catch (error) {
      this.logger.error('Validation step failed', {
        jobId: job.id,
        documentId,
        workerId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      throw error;
    }

    await this.documentsRepository.saveValidationResult(
      documentId,
      {
        isValid: validationResult.isValid,
        warningCount: validationResult.warningCount,
        warnings: validationResult.warnings,
        summary: validationResult.summary,
        validatedAt: new Date(),
        processingTime: validationResult.processingTimeMs,
      },
      DocumentProcessingStatus.VALIDATION_COMPLETED,
    );

    await this.documentsRepository.updateStatus(documentId, {
      processingStatus: DocumentProcessingStatus.WAITING_FOR_REVIEW,
      jobId: job.id,
    });
    await this.heartbeat(job, 100);

    this.logger.info('Job validation step finished — waiting for review', {
      jobId: job.id,
      documentId,
      userId,
      processingStatus: DocumentProcessingStatus.WAITING_FOR_REVIEW,
      warningCount: validationResult.warningCount,
      isValid: validationResult.isValid,
      validationMs: validationResult.processingTimeMs,
      executionTimeMs: Date.now() - startedAt,
      attempt: job.attemptsMade + 1,
      workerId,
      note: 'Human review is manual via API',
    });
  }

  /**
   * Reports progress so BullMQ stays aware the worker is alive during long steps.
   */
  private async heartbeat(job: Job<DocumentProcessingJobPayload>, progress: number): Promise<void> {
    try {
      await job.updateProgress(progress);
    } catch {
      // Non-fatal — lock renewal is the primary heartbeat.
    }
    // Yield the event loop so lock renewals can run after CPU-heavy OCR.
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  private async handleJobFailed(
    job: Job<DocumentProcessingJobPayload> | undefined,
    error: Error,
  ): Promise<void> {
    const maxAttempts = job?.opts.attempts ?? this.config.queue.maxAttempts;
    const attemptsMade = job?.attemptsMade ?? 0;
    const isStallFailure = error.message.includes('stalled more than allowable limit');
    const exhausted =
      attemptsMade >= maxAttempts ||
      error instanceof UnrecoverableError ||
      isStallFailure;

    this.logger.error('Job failed', {
      jobId: job?.id,
      jobName: job?.name,
      documentId: job?.data && 'documentId' in job.data ? job.data.documentId : undefined,
      parentUploadId:
        job?.data && 'parentUploadId' in job.data ? job.data.parentUploadId : undefined,
      userId: job?.data.userId,
      attempt: attemptsMade,
      maxAttempts,
      exhausted,
      isStallFailure,
      error: error.message,
      workerId: process.pid,
      executionTimeMs: job?.processedOn ? Date.now() - job.processedOn : undefined,
    });

    if (!job?.data || !exhausted) {
      return;
    }

    const failedDocumentId =
      'documentId' in job.data
        ? job.data.documentId
        : 'parentUploadId' in job.data
          ? job.data.parentUploadId
          : undefined;

    if (!failedDocumentId) {
      return;
    }

    try {
      await this.documentsRepository.updateStatus(failedDocumentId, {
        processingStatus: DocumentProcessingStatus.FAILED,
        jobId: job.id,
        failureReason: error.message.slice(0, 2000),
      });
    } catch (updateError) {
      this.logger.error('Failed to persist FAILED document status', {
        documentId: failedDocumentId,
        error: updateError instanceof Error ? updateError.message : 'unknown',
      });
    }
  }
}
