import { Router } from 'express';
import type { ConfigService } from '../config';
import { asyncHandler } from '../../common/utils';
import type { AuthenticateMiddleware } from '../../common/middleware/authenticate.middleware';
import type { UploadController } from './upload.controller';
import { createUploadMiddleware, handleMulterError } from './upload.middleware';

/**
 * Builds document upload routes under /api/v1/documents.
 */
export function createUploadRouter(
  controller: UploadController,
  authenticate: AuthenticateMiddleware,
  config: ConfigService,
): Router {
  const router = Router();
  const upload = createUploadMiddleware(config);

  router.post(
    '/upload',
    authenticate,
    (req, res, next) => {
      upload.single(req, res, (error: unknown) => {
        if (error) {
          handleMulterError(error, req, res, next);
          return;
        }
        next();
      });
    },
    asyncHandler(async (req, res) => {
      await controller.uploadSingle(req, res);
    }),
  );

  router.post(
    '/uploads',
    authenticate,
    (req, res, next) => {
      upload.multiple(req, res, (error: unknown) => {
        if (error) {
          handleMulterError(error, req, res, next);
          return;
        }
        next();
      });
    },
    asyncHandler(async (req, res) => {
      await controller.uploadMany(req, res);
    }),
  );

  return router;
}
