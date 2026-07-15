import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { ConfigService } from '../../modules/config';
import type { LoggerService } from '../../modules/logger';
import { ErrorCode } from '../constants';
import { AppException } from '../exceptions';
import { ApiResponse } from '../response';
import type { AppRequest, ErrorDetail } from '../types/api.types';

/**
 * Centralized Express error handler.
 * Converts all errors into the Phase 2 failure envelope.
 * Never exposes stack traces in production.
 */
export function createErrorHandler(config: ConfigService, logger: LoggerService) {
  const log = logger.child('ErrorHandler');

  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    void _next;
    const appReq = req as AppRequest;
    const requestId = appReq.requestId ?? 'unknown';

    if (error instanceof AppException) {
      log.warn('Application exception', {
        requestId,
        code: error.code,
        statusCode: error.statusCode,
        message: error.message,
        details: error.details,
      });

      const errors: ErrorDetail[] =
        error.details.length > 0
          ? error.details
          : [{ code: error.code, message: error.message }];

      ApiResponse.failure(res, {
        message: error.message,
        statusCode: error.statusCode,
        errors,
        requestId,
      });
      return;
    }

    if (error instanceof ZodError) {
      const errors: ErrorDetail[] = error.issues.map((issue) => ({
        code: ErrorCode.VALIDATION_ERROR,
        message: issue.message,
        field: issue.path.join('.') || undefined,
      }));

      ApiResponse.failure(res, {
        message: 'Request validation failed',
        statusCode: 400,
        errors,
        requestId,
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    const stack = error instanceof Error ? error.stack : undefined;

    log.error('Unhandled exception', {
      requestId,
      message,
      stack: config.isProduction ? undefined : stack,
    });

    ApiResponse.failure(res, {
      message: config.isProduction ? 'Internal server error' : message,
      statusCode: 500,
      errors: [{ code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' }],
      requestId,
    });
  };
}
