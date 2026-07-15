import path from 'path';
import {
  ALLOWED_UPLOAD_MIMES,
  AllowedUploadExtension,
  AllowedUploadMime,
  type AllowedUploadMimeValue,
} from '../../../common/constants';
import { ValidationException } from '../../../common/exceptions';
import type { ErrorDetail } from '../../../common/types/api.types';

const MIME_TO_EXTENSIONS: Record<AllowedUploadMimeValue, readonly string[]> = {
  [AllowedUploadMime.PDF]: [AllowedUploadExtension.PDF],
  [AllowedUploadMime.PNG]: [AllowedUploadExtension.PNG],
  [AllowedUploadMime.JPEG]: [AllowedUploadExtension.JPG, AllowedUploadExtension.JPEG],
};

/**
 * Normalized upload candidate after validation.
 */
export interface ValidatedUploadFile {
  buffer: Buffer;
  originalFileName: string;
  mimeType: AllowedUploadMimeValue;
  extension: string;
  fileSize: number;
}

/**
 * Responsibility: Validate MIME, extension, size, emptiness, and magic bytes.
 * Does not perform storage or database writes.
 */
export class FileValidator {
  public constructor(private readonly maxUploadBytes: number) {}

  /**
   * Validates a single multer file and returns a normalized payload.
   */
  public validate(file: Express.Multer.File | undefined): ValidatedUploadFile {
    if (!file) {
      throw new ValidationException('Missing file', [
        { code: 'INVALID_FILE', message: 'File is required', field: 'file' },
      ]);
    }

    if (!file.buffer || file.buffer.length === 0 || file.size === 0) {
      throw new ValidationException('Empty file', [
        { code: 'INVALID_FILE', message: 'File must not be empty', field: 'file' },
      ]);
    }

    if (file.size > this.maxUploadBytes) {
      throw new ValidationException('File too large', [
        {
          code: 'INVALID_FILE',
          message: `File exceeds maximum size of ${this.maxUploadBytes} bytes`,
          field: 'file',
        },
      ]);
    }

    const mimeType = normalizeMime(file.mimetype);
    if (!ALLOWED_UPLOAD_MIMES.includes(mimeType)) {
      throw new ValidationException('Unsupported file type', [
        {
          code: 'INVALID_FILE',
          message: 'Only PDF, PNG, and JPG/JPEG files are allowed',
          field: 'file',
        },
      ]);
    }

    const extension = normalizeExtension(file.originalname);
    const allowedExtensions = MIME_TO_EXTENSIONS[mimeType];

    if (!allowedExtensions.includes(extension)) {
      throw new ValidationException('File extension does not match MIME type', [
        {
          code: 'INVALID_FILE',
          message: `Extension ${extension} is not valid for ${mimeType}`,
          field: 'file',
        },
      ]);
    }

    if (!matchesMagicBytes(file.buffer, mimeType)) {
      throw new ValidationException('Corrupted or invalid file content', [
        {
          code: 'INVALID_FILE',
          message: 'File content does not match the declared type',
          field: 'file',
        },
      ]);
    }

    // Sanitize original name for metadata only — never used for storage paths.
    const originalFileName = sanitizeOriginalName(file.originalname);

    return {
      buffer: file.buffer,
      originalFileName,
      mimeType,
      extension,
      fileSize: file.size,
    };
  }

  /**
   * Validates an array of multer files.
   */
  public validateMany(files: Express.Multer.File[] | undefined): ValidatedUploadFile[] {
    if (!files || files.length === 0) {
      throw new ValidationException('Missing files', [
        { code: 'INVALID_FILE', message: 'At least one file is required', field: 'files' },
      ]);
    }

    const details: ErrorDetail[] = [];
    const validated: ValidatedUploadFile[] = [];

    files.forEach((file, index) => {
      try {
        validated.push(this.validate(file));
      } catch (error) {
        if (error instanceof ValidationException) {
          details.push(
            ...error.details.map((detail) => ({
              ...detail,
              field: detail.field ? `files[${index}].${detail.field}` : `files[${index}]`,
            })),
          );
          return;
        }

        throw error;
      }
    });

    if (details.length > 0) {
      throw new ValidationException('One or more files failed validation', details);
    }

    return validated;
  }
}

function normalizeMime(mime: string): AllowedUploadMimeValue {
  const value = mime.toLowerCase().trim() as AllowedUploadMimeValue;
  return value;
}

function normalizeExtension(originalName: string): string {
  const ext = path.extname(originalName || '').toLowerCase();
  return ext;
}

function sanitizeOriginalName(originalName: string): string {
  const base = path.basename(originalName || 'upload').replace(/[^\w.\-() ]+/g, '_');
  return base.slice(0, 255) || 'upload';
}

/**
 * Lightweight magic-byte checks to reject renamed executables / corrupted payloads.
 */
function matchesMagicBytes(buffer: Buffer, mimeType: AllowedUploadMimeValue): boolean {
  if (buffer.length < 4) {
    return false;
  }

  if (mimeType === AllowedUploadMime.PDF) {
    return buffer.subarray(0, 4).toString('utf8') === '%PDF';
  }

  if (mimeType === AllowedUploadMime.PNG) {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  if (mimeType === AllowedUploadMime.JPEG) {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  return false;
}
