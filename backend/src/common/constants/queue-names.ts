/**
 * Queue / job constants for document background processing.
 * Phase 5: one queue only — DocumentProcessingQueue.
 */
export const QueueName = {
  DOCUMENT_PROCESSING: 'DocumentProcessingQueue',
} as const;

export type QueueNameValue = (typeof QueueName)[keyof typeof QueueName];

/**
 * Single job type for the processing pipeline.
 * Future OCR → AI → Validation runs inside this job's worker (later phases).
 */
export const JobName = {
  PROCESS_DOCUMENT: 'PROCESS_DOCUMENT',
  SPLIT_UPLOAD: 'SPLIT_UPLOAD',
} as const;

export type JobNameValue = (typeof JobName)[keyof typeof JobName];
