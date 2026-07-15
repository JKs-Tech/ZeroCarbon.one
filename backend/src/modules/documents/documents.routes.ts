import { Router } from 'express';
import { Role } from '../../common/constants';
import { asyncHandler } from '../../common/utils';
import type { AuthenticateMiddleware } from '../../common/middleware/authenticate.middleware';
import type { AuthorizeMiddleware } from '../../common/middleware/rbac.middleware';
import type { DocumentsController } from './documents.controller';

/**
 * Document list/detail routes under /api/v1/documents.
 * Mounted alongside upload and review routers.
 */
export function createDocumentsRouter(
  controller: DocumentsController,
  authenticate: AuthenticateMiddleware,
  authorize: AuthorizeMiddleware,
): Router {
  const router = Router();

  router.get(
    '/',
    authenticate,
    authorize(Role.ADMIN, Role.USER),
    asyncHandler(async (req, res) => {
      await controller.list(req, res);
    }),
  );

  router.get(
    '/:id',
    authenticate,
    authorize(Role.ADMIN, Role.USER),
    asyncHandler(async (req, res) => {
      await controller.getById(req, res);
    }),
  );

  router.post(
    '/:id/reprocess',
    authenticate,
    authorize(Role.ADMIN, Role.USER),
    asyncHandler(async (req, res) => {
      await controller.reprocess(req, res);
    }),
  );

  return router;
}
