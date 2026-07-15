import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { ConfigService } from '../config';
import { ErrorCode } from '../../common/constants';
import { ApiResponse } from '../../common/response';
import { asyncHandler } from '../../common/utils';
import type { AppRequest } from '../../common/types/api.types';
import type { AuthenticateMiddleware } from '../../common/middleware/authenticate.middleware';
import {
  authenticationValidation,
  type AuthenticationController,
} from './authentication.controller';

/**
 * Builds authentication routes under /api/v1/auth.
 */
export function createAuthenticationRouter(
  controller: AuthenticationController,
  authenticate: AuthenticateMiddleware,
  config: ConfigService,
): Router {
  const router = Router();

  const authLimiter = rateLimit({
    windowMs: config.security.authRateLimitWindowMs,
    max: config.security.authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const appReq = req as AppRequest;
      ApiResponse.failure(res, {
        message: 'Too many authentication attempts',
        statusCode: 429,
        errors: [{ code: ErrorCode.RATE_LIMITED, message: 'Rate limit exceeded' }],
        requestId: appReq.requestId ?? 'unknown',
      });
    },
  });

  router.post(
    '/register',
    authLimiter,
    authenticationValidation.register,
    asyncHandler(async (req, res) => {
      await controller.register(req, res);
    }),
  );

  router.post(
    '/login',
    authLimiter,
    authenticationValidation.login,
    asyncHandler(async (req, res) => {
      await controller.login(req, res);
    }),
  );

  router.get(
    '/profile',
    authenticate,
    asyncHandler(async (req, res) => {
      await controller.profile(req, res);
    }),
  );

  return router;
}
