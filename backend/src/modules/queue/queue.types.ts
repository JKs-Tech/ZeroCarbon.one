import type { JobNameValue, QueueNameValue } from './queue.constants';

/**
 * PROCESS_DOCUMENT job payload.
 * Keep minimal — worker loads file/metadata from Mongo + Storage.
 * Never put file bytes in Redis.
 */
export interface ProcessDocumentJobPayload {
  documentId: string;
  userId: string;
  uploadedAt: string;
}

/**
 * SPLIT_UPLOAD job payload — splits a multi-page PDF parent into page documents.
 */
export interface SplitUploadJobPayload {
  parentUploadId: string;
  userId: string;
  uploadedAt: string;
}

export type DocumentProcessingJobPayload = ProcessDocumentJobPayload | SplitUploadJobPayload;

/**
 * Options when enqueueing a process-document job.
 */
export interface EnqueueProcessDocumentOptions {
  /** Idempotent job id — typically the documentId. */
  jobId?: string;
}

/**
 * Queue health snapshot for GET /health.
 */
export interface QueueHealthSnapshot {
  connected: boolean;
  initialized: boolean;
  workerRunning: boolean;
  registeredWorkers: number;
  connectedWorkers: number;
  prefix: string;
  queueName: QueueNameValue;
  pendingJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  delayedJobs: number;
}

/**
 * Internal enqueue options for QueueService.
 */
export interface EnqueueOptions {
  jobId?: string;
  delayMs?: number;
  priority?: number;
}

export type { JobNameValue, QueueNameValue };
