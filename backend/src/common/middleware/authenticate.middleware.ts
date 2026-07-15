import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { LoggerService } from '../../modules/logger';
import type { UsersService } from '../../modules/users';
import { UnauthorizedException } from '../exceptions';
import type { AppRequest } from '../types/api.types';
import type { JwtStrategy } from '../../modules/authentication/strategies/jwt.strategy';
import { Role, type RoleValue } from '../constants';

export type AuthenticateMiddleware = RequestHandler;

/**
 * Creates JWT authentication middleware.
 * Validates Bearer token, loads user, attaches `req.user`.
 */
export function createAuthenticateMiddleware(
  jwtStrategy: JwtStrategy,
  usersService: UsersService,
  logger: LoggerService,
): AuthenticateMiddleware {
  const log = logger.child('AuthGuard');

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const appReq = req as AppRequest;
      const header = req.header('authorization');

      if (!header || !header.startsWith('Bearer ')) {
        log.warn('Unauthorized access — missing bearer token', {
          requestId: appReq.requestId,
          path: req.originalUrl,
        });
        throw new UnauthorizedException('Authentication required');
      }

      const token = header.slice('Bearer '.length).trim();

      if (!token) {
        throw new UnauthorizedException('Authentication required');
      }

      const payload = jwtStrategy.verify(token);
      const user = await usersService.getById(payload.sub);

      if (user.role !== payload.role || user.email !== payload.email) {
        // Token claims stale relative to DB — force re-login.
        throw new UnauthorizedException('Invalid token');
      }

      appReq.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Asserts the request has an authenticated user (for use inside controllers).
 */
export function requireAuthenticatedUser(req: AppRequest): NonNullable<AppRequest['user']> {
  if (!req.user) {
    throw new UnauthorizedException('Authentication required');
  }

  return req.user;
}

export { Role };
export type { RoleValue };
