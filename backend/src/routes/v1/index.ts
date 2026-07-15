import { Router } from 'express';
import type { AppContainer } from '../../container';
import { createHealthRouter } from '../../modules/health';
import { createAuthenticationRouter } from '../../modules/authentication';
import { createUsersRouter } from '../../modules/users';
import { createUploadRouter } from '../../modules/upload';
import { createReviewRouter } from '../../modules/review';
import { createDocumentsRouter } from '../../modules/documents';
import { ApiPath } from '../../common/constants';

/**
 * Mounts versioned API routes under /api/v1.
 * Future versions (v2) can be added beside this without breaking clients.
 */
export function createV1Router(container: AppContainer): Router {
  const router = Router();

  router.use('/health', createHealthRouter(container.healthController));
  router.use(
    '/auth',
    createAuthenticationRouter(
      container.authenticationController,
      container.authenticate,
      container.config,
    ),
  );
  router.use(
    '/users',
    createUsersRouter(
      container.usersController,
      container.authenticate,
      container.authorize,
    ),
  );
  router.use(
    '/documents',
    createUploadRouter(
      container.uploadController,
      container.authenticate,
      container.config,
    ),
  );
  router.use(
    '/documents',
    createDocumentsRouter(
      container.documentsController,
      container.authenticate,
      container.authorize,
    ),
  );
  router.use(
    '/documents',
    createReviewRouter(
      container.reviewController,
      container.authenticate,
      container.authorize,
    ),
  );

  return router;
}

export { ApiPath };
