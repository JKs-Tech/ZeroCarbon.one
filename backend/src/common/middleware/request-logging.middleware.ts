import type { NextFunction, Request, Response } from 'express';
import type { LoggerService } from '../../modules/logger';
import type { AppRequest } from '../types/api.types';
import { formatDurationMs } from '../utils/date';

/**
 * Logs HTTP request start and completion with method, path, status, and duration.
 */
export function createRequestLoggingMiddleware(logger: LoggerService) {
  const log = logger.child('Http');

  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = Date.now();
    const appReq = req as AppRequest;

    log.info('Incoming request', {
      requestId: appReq.requestId,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
    });

    res.on('finish', () => {
      log.info('Request completed', {
        requestId: appReq.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: formatDurationMs(startedAt),
      });
    });

    next();
  };
}
