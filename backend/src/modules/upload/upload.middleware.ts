import multer, { MulterError } from 'multer';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ConfigService } from '../config';
import { ErrorCode } from '../../common/constants';
import { ValidationException } from '../../common/exceptions';
import { UploadField } from './dto/upload-file.dto';

/**
 * Creates multer middleware that buffers uploads in memory.
 * Files are validated and persisted by UploadService / StorageService next.
 */
export function createUploadMiddleware(config: ConfigService): {
  single: RequestHandler;
  multiple: RequestHandler;
} {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.storage.maxUploadBytes,
      files: config.storage.maxFilesPerUpload,
    },
  });

  return {
    single: upload.single(UploadField.SINGLE),
    multiple: upload.array(UploadField.MULTIPLE, config.storage.maxFilesPerUpload),
  };
}

/**
 * Maps multer errors to ValidationException for the global error handler.
 */
export function handleMulterError(
  error: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!(error instanceof MulterError)) {
    next(error);
    return;
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    next(
      new ValidationException('File too large', [
        {
          code: ErrorCode.INVALID_FILE,
          message: 'Uploaded file exceeds the configured size limit',
          field: 'file',
        },
      ]),
    );
    return;
  }

  if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
    next(
      new ValidationException('Invalid multipart upload', [
        {
          code: ErrorCode.INVALID_FILE,
          message: error.message,
          field: 'files',
        },
      ]),
    );
    return;
  }

  next(
    new ValidationException('Invalid multipart request', [
      {
        code: ErrorCode.INVALID_FILE,
        message: error.message,
      },
    ]),
  );
}
