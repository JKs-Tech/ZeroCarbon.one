import { Router } from 'express';
import { Role } from '../../common/constants';
import { asyncHandler } from '../../common/utils';
import type { AuthenticateMiddleware } from '../../common/middleware/authenticate.middleware';
import type { AuthorizeMiddleware } from '../../common/middleware/rbac.middleware';
import { usersValidation, type UsersController } from './users.controller';

/**
 * Builds user management routes under /api/v1/users.
 */
export function createUsersRouter(
  controller: UsersController,
  authenticate: AuthenticateMiddleware,
  authorize: AuthorizeMiddleware,
): Router {
  const router = Router();

  router.get(
    '/',
    authenticate,
    authorize(Role.ADMIN),
    asyncHandler(async (req, res) => {
      await controller.list(req, res);
    }),
  );

  router.get(
    '/:id',
    authenticate,
    asyncHandler(async (req, res) => {
      await controller.getById(req, res);
    }),
  );

  router.patch(
    '/:id',
    authenticate,
    authorize(Role.ADMIN),
    usersValidation.update,
    asyncHandler(async (req, res) => {
      await controller.update(req, res);
    }),
  );

  return router;
}
