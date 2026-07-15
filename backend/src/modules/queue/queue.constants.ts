/**
 * Queue module constants (Phase 5 folder contract).
 * Re-exports shared constants for module-local imports.
 */
export {
  QueueName,
  JobName,
  type QueueNameValue,
  type JobNameValue,
} from '../../common/constants/queue-names';

/** Default human-readable queue label for logs/health. */
export const DOCUMENT_PROCESSING_QUEUE_NAME = 'DocumentProcessingQueue';
