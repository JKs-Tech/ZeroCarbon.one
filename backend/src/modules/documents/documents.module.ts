/**
 * Documents module — metadata persistence + list/detail + status.
 */
export { DocumentsRepository } from './documents.repository';
export type {
  DocumentListStatusFilter,
  DocumentStatusCounts,
} from './documents.repository';
export { DocumentsService } from './documents.service';
export { DocumentsController } from './documents.controller';
export { createDocumentsRouter } from './documents.routes';
export {
  DocumentModel,
  toPublicDocument,
} from './schemas/document.schema';
export type {
  DocumentRecord,
  PublicDocument,
  IDocument,
  DocumentOcrArtifact,
  DocumentClassificationArtifact,
  DocumentVendorArtifact,
  DocumentExtractionArtifact,
  DocumentValidationArtifact,
  DocumentValidationWarning,
  DocumentApprovalArtifact,
} from './schemas/document.schema';
export { DocumentProcessingStatus } from './state/document-status.machine';
