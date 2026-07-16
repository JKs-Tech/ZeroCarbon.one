import { Queue, type DefaultJobOptions, type JobsOptions } from 'bullmq';
import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';
import { JobName, QueueName } from './queue.constants';
import { buildRedisConnection } from './redis-connection';
import type {
  DocumentProcessingJobPayload,
  EnqueueOptions,
  EnqueueProcessDocumentOptions,
  ProcessDocumentJobPayload,
  QueueHealthSnapshot,
  SplitUploadJobPayload,
} from './queue.types';

/**
 * Responsibility: Application-facing queue API.
 * Business modules must never construct BullMQ clients directly — use this service.
 *
 * One queue (DocumentProcessingQueue), job types: PROCESS_DOCUMENT, SPLIT_UPLOAD.
 */
export class QueueService {
  private queue: Queue<DocumentProcessingJobPayload> | undefined;
  private initialized = false;
  private registeredWorkerCount = 0;

  public constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Initializes the DocumentProcessingQueue producer.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.getQueue();
    this.initialized = true;
    this.logger.info('Queue infrastructure initialized', {
      queue: QueueName.DOCUMENT_PROCESSING,
      prefix: this.config.queue.prefix,
      maxAttempts: this.config.queue.maxAttempts,
      backoffMs: this.config.queue.backoffMs,
    });
  }

  /**
   * Returns (and lazily creates) the single document-processing queue.
   */
  public getQueue(): Queue<DocumentProcessingJobPayload> {
    if (this.queue) {
      return this.queue;
    }

    this.queue = new Queue<DocumentProcessingJobPayload>(QueueName.DOCUMENT_PROCESSING, {
      connection: buildRedisConnection(this.config),
      prefix: this.config.queue.prefix,
      defaultJobOptions: this.defaultJobOptions(),
    });

    return this.queue;
  }

  /**
   * Enqueues PROCESS_DOCUMENT after upload.
   * Payload stays small — worker loads the rest from MongoDB.
   */
  public async enqueueProcessDocument(
    payload: ProcessDocumentJobPayload,
    options: EnqueueProcessDocumentOptions = {},
  ): Promise<string | undefined> {
    return this.enqueue(JobName.PROCESS_DOCUMENT, payload, {
      jobId: options.jobId ?? payload.documentId,
    });
  }

  /**
   * Enqueues many PROCESS_DOCUMENT jobs efficiently (bulk Redis write).
   */
  public async enqueueProcessDocuments(
    payloads: ProcessDocumentJobPayload[],
  ): Promise<string[]> {
    if (payloads.length === 0) {
      return [];
    }

    const queue = this.getQueue();
    const jobs = await queue.addBulk(
      payloads.map((payload) => ({
        name: JobName.PROCESS_DOCUMENT,
        data: payload,
        opts: {
          jobId: payload.documentId,
          ...this.defaultJobOptions(),
        },
      })),
    );

    this.logger.info('Jobs created (bulk)', {
      queue: QueueName.DOCUMENT_PROCESSING,
      count: jobs.length,
    });

    return jobs.map((job) => job.id).filter((id): id is string => Boolean(id));
  }

  /**
   * Enqueues SPLIT_UPLOAD for a multi-page PDF parent upload.
   */
  public async enqueueSplitUpload(
    payload: SplitUploadJobPayload,
    options: EnqueueProcessDocumentOptions = {},
  ): Promise<string | undefined> {
    return this.enqueue(JobName.SPLIT_UPLOAD, payload, {
      jobId: options.jobId ?? `split-${payload.parentUploadId}`,
    });
  }

  /**
   * Removes an existing BullMQ job (any state) so it can be re-enqueued with the same id.
   */
  public async removeJob(jobId: string): Promise<boolean> {
    const queue = this.getQueue();
    const job = await queue.getJob(jobId);
    if (!job) {
      return false;
    }
    await job.remove();
    this.logger.info('Job removed for requeue', {
      queue: QueueName.DOCUMENT_PROCESSING,
      jobId,
    });
    return true;
  }

  /**
   * Low-level enqueue for the document-processing queue.
   */
  public async enqueue(
    jobName: typeof JobName.PROCESS_DOCUMENT | typeof JobName.SPLIT_UPLOAD,
    data: DocumentProcessingJobPayload,
    options: EnqueueOptions = {},
  ): Promise<string | undefined> {
    const queue = this.getQueue();
    const jobOptions: JobsOptions = {
      jobId: options.jobId,
      delay: options.delayMs,
      priority: options.priority,
    };

    const job = await queue.add(jobName, data, jobOptions);

    this.logger.info('Job created', {
      queue: QueueName.DOCUMENT_PROCESSING,
      jobName,
      jobId: job.id,
      documentId: 'documentId' in data ? data.documentId : undefined,
      parentUploadId: 'parentUploadId' in data ? data.parentUploadId : undefined,
      userId: data.userId,
    });

    return job.id;
  }

  /**
   * Tracks workers registered in this process (API usually 0; worker process >= 1).
   */
  public setRegisteredWorkerCount(count: number): void {
    this.registeredWorkerCount = count;
  }

  /**
   * Health snapshot used by GET /health.
   */
  public async getHealthSnapshot(): Promise<QueueHealthSnapshot> {
    const queue = this.getQueue();
    const [counts, workers] = await Promise.all([
      queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      queue.getWorkers(),
    ]);

    const connectedWorkers = workers.length;
    const pendingJobs = (counts.waiting ?? 0) + (counts.delayed ?? 0);

    return {
      connected: this.initialized,
      initialized: this.initialized,
      workerRunning: connectedWorkers > 0 || this.registeredWorkerCount > 0,
      registeredWorkers: this.registeredWorkerCount,
      connectedWorkers,
      prefix: this.config.queue.prefix,
      queueName: QueueName.DOCUMENT_PROCESSING,
      pendingJobs,
      activeJobs: counts.active ?? 0,
      completedJobs: counts.completed ?? 0,
      failedJobs: counts.failed ?? 0,
      delayedJobs: counts.delayed ?? 0,
    };
  }

  /**
   * Graceful shutdown — close producer connections owned by this process.
   */
  public async shutdown(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = undefined;
    }

    this.initialized = false;
    this.registeredWorkerCount = 0;
    this.logger.info('Queue service shut down');
  }

  private defaultJobOptions(): DefaultJobOptions {
    return {
      attempts: this.config.queue.maxAttempts,
      backoff: {
        type: 'exponential',
        delay: this.config.queue.backoffMs,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    };
  }
}
