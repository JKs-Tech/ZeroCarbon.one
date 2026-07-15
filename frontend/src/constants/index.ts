export const Role = {
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;

export type RoleValue = (typeof Role)[keyof typeof Role];

export const DocumentProcessingStatus = {
  UPLOADED: 'UPLOADED',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  OCR_PROCESSING: 'OCR_PROCESSING',
  OCR_COMPLETED: 'OCR_COMPLETED',
  AI_PROCESSING: 'AI_PROCESSING',
  AI_COMPLETED: 'AI_COMPLETED',
  VALIDATING: 'VALIDATING',
  VALIDATION_COMPLETED: 'VALIDATION_COMPLETED',
  WAITING_FOR_REVIEW: 'WAITING_FOR_REVIEW',
  APPROVED: 'APPROVED',
  FAILED: 'FAILED',
} as const;

export type DocumentProcessingStatusValue =
  (typeof DocumentProcessingStatus)[keyof typeof DocumentProcessingStatus];

export const TOKEN_STORAGE_KEY = 'zc_access_token';
export const QUERY_KEYS = {
  profile: ['auth', 'profile'] as const,
  documents: ['documents'] as const,
  documentsList: (page: number, limit: number, status: string) =>
    ['documents', 'list', page, limit, status] as const,
  document: (id: string) => ['documents', id] as const,
  review: (id: string) => ['review', id] as const,
  users: ['users'] as const,
  usersList: (page: number, limit: number) => ['users', 'list', page, limit] as const,
} as const;

export const PAGE_SIZE = {
  documents: 12,
  adminDocuments: 10,
  users: 10,
} as const;

/** Files per HTTP upload request — stay under multer / memory limits. */
export const UPLOAD_BATCH_SIZE = 20;
/** Parallel upload HTTP requests during a bulk run. */
export const UPLOAD_PARALLEL_BATCHES = 2;

export const ACCEPTED_UPLOAD_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};
