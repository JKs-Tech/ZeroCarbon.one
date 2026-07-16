/**
 * Document processing status values for the pipeline.
 * Phase 9: … → VALIDATION_COMPLETED → WAITING_FOR_REVIEW → APPROVED
 * FAILED on terminal unexpected errors.
 */
export const DocumentProcessingStatus = {
  UPLOADED: 'UPLOADED',
  SPLITTING: 'SPLITTING',
  SPLIT_COMPLETE: 'SPLIT_COMPLETE',
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

/**
 * Allowed upload MIME types (assignment Phase 4).
 */
export const AllowedUploadMime = {
  PDF: 'application/pdf',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
} as const;

export type AllowedUploadMimeValue =
  (typeof AllowedUploadMime)[keyof typeof AllowedUploadMime];

export const ALLOWED_UPLOAD_MIMES: readonly AllowedUploadMimeValue[] = [
  AllowedUploadMime.PDF,
  AllowedUploadMime.PNG,
  AllowedUploadMime.JPEG,
];

/**
 * Allowed file extensions mapped from MIME.
 */
export const AllowedUploadExtension = {
  PDF: '.pdf',
  PNG: '.png',
  JPG: '.jpg',
  JPEG: '.jpeg',
} as const;
