import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';
import type { StorageService } from '../storage';
import type { DocumentsRepository } from '../documents';
import { DocumentProcessingStatus } from '../documents';
import type { PublicDocument } from '../documents';
import type { QueueService } from '../queue';
import { FileValidator, type ValidatedUploadFile } from './validators/file.validator';

/**
 * Responsibility: Orchestrate validate → store → persist document → enqueue processing.
 * Controllers call this service only. Upload returns immediately after enqueue (no OCR wait).
 */
export class UploadService {
  private readonly fileValidator: FileValidator;

  public constructor(
    private readonly storageService: StorageService,
    private readonly documentsRepository: DocumentsRepository,
    private readonly queueService: QueueService,
    private readonly logger: LoggerService,
    config: ConfigService,
  ) {
    this.fileValidator = new FileValidator(config.storage.maxUploadBytes);
  }

  /**
   * Uploads a single validated file for the authenticated user.
   */
  public async uploadSingle(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<PublicDocument> {
    const startedAt = Date.now();
    this.logger.info('Upload started', { userId, mode: 'single' });

    try {
      const validated = this.fileValidator.validate(file);
      const document = await this.persistAndEnqueue(userId, validated);

      this.logger.info('Upload completed', {
        userId,
        documentId: document.id,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        processingStatus: document.processingStatus,
        durationMs: Date.now() - startedAt,
      });

      return document;
    } catch (error) {
      this.logger.warn('Upload failed', {
        userId,
        mode: 'single',
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'unknown',
      });
      throw error;
    }
  }

  /**
   * Uploads multiple files for the authenticated user.
   * Stores sequentially (memory-safe), then enqueues with BullMQ addBulk.
   */
  public async uploadMany(
    userId: string,
    files: Express.Multer.File[] | undefined,
  ): Promise<PublicDocument[]> {
    const startedAt = Date.now();
    this.logger.info('Upload started', {
      userId,
      mode: 'multiple',
      count: files?.length ?? 0,
    });

    try {
      const validatedFiles = this.fileValidator.validateMany(files);
      const prepared: Array<{
        documentId: string;
        uploadedAt: string;
        publicDoc: PublicDocument;
      }> = [];

      for (let index = 0; index < validatedFiles.length; index += 1) {
        const validated = validatedFiles[index];
        const preparedDoc = await this.storeAndCreate(userId, validated);
        prepared.push(preparedDoc);
        if (index < validatedFiles.length - 1) {
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
      }

      try {
        await this.queueService.enqueueProcessDocuments(
          prepared.map((item) => ({
            documentId: item.documentId,
            userId,
            uploadedAt: item.uploadedAt,
          })),
        );
      } catch (error) {
        await Promise.all(
          prepared.map((item) =>
            this.documentsRepository
              .updateStatus(item.documentId, {
                processingStatus: DocumentProcessingStatus.FAILED,
                failureReason:
                  error instanceof Error
                    ? `Queue enqueue failed: ${error.message}`.slice(0, 2000)
                    : 'Queue enqueue failed',
              })
              .catch(() => undefined),
          ),
        );
        throw error;
      }

      const documents: PublicDocument[] = [];
      for (const item of prepared) {
        const queued = await this.documentsRepository.updateStatus(item.documentId, {
          processingStatus: DocumentProcessingStatus.QUEUED,
          jobId: item.documentId,
          failureReason: null,
        });
        documents.push(
          queued
            ? this.documentsRepository.toPublic(queued)
            : {
                ...item.publicDoc,
                processingStatus: DocumentProcessingStatus.QUEUED,
                jobId: item.documentId,
              },
        );
      }

      this.logger.info('Upload completed', {
        userId,
        mode: 'multiple',
        count: documents.length,
        documentIds: documents.map((doc) => doc.id),
        durationMs: Date.now() - startedAt,
      });

      return documents;
    } catch (error) {
      this.logger.warn('Upload failed', {
        userId,
        mode: 'multiple',
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'unknown',
      });
      throw error;
    }
  }

  private async storeAndCreate(
    userId: string,
    validated: ValidatedUploadFile,
  ): Promise<{ documentId: string; uploadedAt: string; publicDoc: PublicDocument }> {
    const stored = await this.storageService.store({
      buffer: validated.buffer,
      mimeType: validated.mimeType,
      extension: validated.extension,
    });

    try {
      const record = await this.documentsRepository.create({
        userId,
        originalFileName: validated.originalFileName,
        storedFileName: stored.storedFileName,
        storagePath: stored.storagePath,
        mimeType: stored.mimeType,
        fileSize: stored.size,
        processingStatus: DocumentProcessingStatus.UPLOADED,
      });

      return {
        documentId: record._id.toString(),
        uploadedAt: record.uploadTimestamp.toISOString(),
        publicDoc: this.documentsRepository.toPublic(record),
      };
    } catch (error) {
      await this.storageService.delete(stored.storagePath).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Stores file, creates document (UPLOADED), enqueues PROCESS_DOCUMENT, marks QUEUED.
   * Never waits for worker OCR/AI — enqueue is Redis-only and returns quickly.
   */
  private async persistAndEnqueue(
    userId: string,
    validated: ValidatedUploadFile,
  ): Promise<PublicDocument> {
    const prepared = await this.storeAndCreate(userId, validated);
    const { documentId, uploadedAt } = prepared;

    try {
      const jobId = await this.queueService.enqueueProcessDocument({
        documentId,
        userId,
        uploadedAt,
      });

      const queued = await this.documentsRepository.updateStatus(documentId, {
        processingStatus: DocumentProcessingStatus.QUEUED,
        jobId,
        failureReason: null,
      });

      return this.documentsRepository.toPublic(queued ?? (await this.documentsRepository.findById(documentId))!);
    } catch (error) {
      await this.documentsRepository
        .updateStatus(documentId, {
          processingStatus: DocumentProcessingStatus.FAILED,
          failureReason:
            error instanceof Error
              ? `Queue enqueue failed: ${error.message}`.slice(0, 2000)
              : 'Queue enqueue failed',
        })
        .catch(() => undefined);

      throw error;
    }
  }
}
