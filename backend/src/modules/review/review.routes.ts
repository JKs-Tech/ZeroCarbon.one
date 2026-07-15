import { Router } from 'express';
import { Role } from '../../common/constants';
import { asyncHandler } from '../../common/utils';
import { validateRequest } from '../../common/validation';
import type { AuthenticateMiddleware } from '../../common/middleware/authenticate.middleware';
import type { AuthorizeMiddleware } from '../../common/middleware/rbac.middleware';
import type { ReviewController } from './review.controller';
import { documentIdParamSchema, updateReviewSchema } from './dto/update-review.dto';

/**
 * Builds Human Review routes under /api/v1/documents.
 */
export function createReviewRouter(
  controller: ReviewController,
  authenticate: AuthenticateMiddleware,
  authorize: AuthorizeMiddleware,
): Router {
  const router = Router();

  router.get(
    '/:id/review',
    authenticate,
    authorize(Role.ADMIN, Role.USER),
    validateRequest(documentIdParamSchema, 'params'),
    asyncHandler(async (req, res) => {
      await controller.getReview(req, res);
    }),
  );

  router.put(
    '/:id/review',
    authenticate,
    authorize(Role.ADMIN, Role.USER),
    validateRequest(documentIdParamSchema, 'params'),
    validateRequest(updateReviewSchema, 'body'),
    asyncHandler(async (req, res) => {
      await controller.updateReview(req, res);
    }),
  );

  router.post(
    '/:id/approve',
    authenticate,
    authorize(Role.ADMIN, Role.USER),
    validateRequest(documentIdParamSchema, 'params'),
    asyncHandler(async (req, res) => {
      await controller.approve(req, res);
    }),
  );

  return router;
}
