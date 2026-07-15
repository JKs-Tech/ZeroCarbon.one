/**
 * Queue module wiring (Express composition equivalent of queue.module.ts).
 */
export { QueueService } from './queue.service';
export { DocumentProcessingWorker } from './document-processing.worker';
export { buildRedisConnection } from './redis-connection';
export { JobName, QueueName, DOCUMENT_PROCESSING_QUEUE_NAME } from './queue.constants';
export type {
  ProcessDocumentJobPayload,
  EnqueueProcessDocumentOptions,
  EnqueueOptions,
  QueueHealthSnapshot,
  JobNameValue,
  QueueNameValue,
} from './queue.types';
