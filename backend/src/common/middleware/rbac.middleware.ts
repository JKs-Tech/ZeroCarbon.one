import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { LoggerService } from '../../modules/logger';
import { Role, type RoleValue } from '../constants';
import { ForbiddenException, UnauthorizedException } from '../exceptions';
import type { AppRequest } from '../types/api.types';

export type AuthorizeMiddleware = (...roles: RoleValue[]) => RequestHandler;

/**
 * Creates reusable RBAC middleware.
 *
 * Usage:
 * - authorize(Role.ADMIN) — admin only
 * - authorize(Role.ADMIN, Role.USER) — any authenticated role in the list
 *
 * Admin can access everything when combined with resource checks:
 * use `requireSelfOrAdmin` on UsersService for owner-scoped resources (documents later).
 */
export function createAuthorizeMiddleware(logger: LoggerService): AuthorizeMiddleware {
  const log = logger.child('RbacGuard');

  return (...allowedRoles: RoleValue[]): RequestHandler => {
    return (req: Request, _res: Response, next: NextFunction): void => {
      const appReq = req as AppRequest;

      if (!appReq.user) {
        log.warn('Unauthorized access — no authenticated user for RBAC check', {
          requestId: appReq.requestId,
          path: req.originalUrl,
        });
        next(new UnauthorizedException('Authentication required'));
        return;
      }

      if (appReq.user.role === Role.ADMIN) {
        // Admin can access everything.
        next();
        return;
      }

      if (!allowedRoles.includes(appReq.user.role)) {
        log.warn('Forbidden access', {
          requestId: appReq.requestId,
          userId: appReq.user.id,
          role: appReq.user.role,
          requiredRoles: allowedRoles,
          path: req.originalUrl,
        });
        next(new ForbiddenException('Insufficient permissions'));
        return;
      }

      next();
    };
  };
}

/**
 * Middleware factory: USER may only continue when `paramName` matches their user id.
 * ADMIN always continues. Designed for future document/owner routes.
 *
 * Example: requireSelfOrAdmin('userId') on /users/:userId/documents
 */
export function createRequireSelfOrAdminMiddleware(
  logger: LoggerService,
  paramName = 'id',
): RequestHandler {
  const log = logger.child('RbacGuard');

  return (req: Request, _res: Response, next: NextFunction): void => {
    const appReq = req as AppRequest;

    if (!appReq.user) {
      next(new UnauthorizedException('Authentication required'));
      return;
    }

    if (appReq.user.role === Role.ADMIN) {
      next();
      return;
    }

    const resourceOwnerId = req.params[paramName];

    if (!resourceOwnerId || appReq.user.id !== resourceOwnerId) {
      log.warn('Forbidden access — resource ownership mismatch', {
        requestId: appReq.requestId,
        userId: appReq.user.id,
        resourceOwnerId,
        path: req.originalUrl,
      });
      next(new ForbiddenException('You can only access your own resources'));
      return;
    }

    next();
  };
}
