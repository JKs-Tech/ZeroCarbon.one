import type { Request, Response } from 'express';
import { ErrorCode } from '../constants';
import { ApiResponse } from '../response';
import type { AppRequest } from '../types/api.types';

/**
 * Handles unmatched routes with a standardized 404 envelope.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const appReq = req as AppRequest;

  ApiResponse.failure(res, {
    message: `Route ${req.method} ${req.originalUrl} not found`,
    statusCode: 404,
    errors: [{ code: ErrorCode.NOT_FOUND, message: 'Route not found' }],
    requestId: appReq.requestId ?? 'unknown',
  });
}
