import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { Express, RequestHandler } from 'express';
import type { ConfigService } from '../../modules/config';
import { ErrorCode } from '../constants';
import { ApiResponse } from '../response';
import type { AppRequest } from '../types/api.types';

/**
 * Applies enterprise security and HTTP hardening middleware.
 * Helmet, CORS, compression, rate limiting, body limits are owned here.
 */
export function applySecurityMiddleware(app: Express, config: ConfigService): void {
  if (config.security.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(helmet());

  app.use(
    cors({
      origin: config.security.corsOrigin,
      credentials: true,
    }),
  );

  app.use(compression());

  const limiter = rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const appReq = req as AppRequest;
      ApiResponse.failure(res, {
        message: 'Too many requests',
        statusCode: 429,
        errors: [{ code: ErrorCode.RATE_LIMITED, message: 'Rate limit exceeded' }],
        requestId: appReq.requestId ?? 'unknown',
      });
    },
  });

  app.use(limiter);
}

/**
 * Returns configured multipart max upload size (bytes).
 * Enforced by multer in the upload module.
 */
export function getUploadMaxBytes(config: ConfigService): number {
  return config.security.uploadMaxBytes;
}

export type { RequestHandler };
