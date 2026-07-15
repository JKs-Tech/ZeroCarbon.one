import type { Response } from 'express';
import type {
  ErrorDetail,
  FailureResponseBody,
  PaginationMeta,
  ResponseMeta,
  SuccessResponseBody,
} from '../types/api.types';
import { nowIso } from '../utils/date';

/**
 * Responsibility: Build standardized success and failure API envelopes.
 * Controllers must use these helpers instead of crafting response bodies manually.
 */
export class ApiResponse {
  /**
   * Sends a successful JSON response.
   */
  public static success<T>(
    res: Response,
    data: T,
    options: {
      message?: string;
      statusCode?: number;
      requestId: string;
      pagination?: PaginationMeta;
    },
  ): Response {
    const meta: ResponseMeta = {
      requestId: options.requestId,
      timestamp: nowIso(),
      ...(options.pagination
        ? {
            page: options.pagination.page,
            limit: options.pagination.limit,
            total: options.pagination.total,
            totalPages: options.pagination.totalPages,
          }
        : {}),
    };

    const body: SuccessResponseBody<T> = {
      success: true,
      message: options.message ?? 'OK',
      data,
      meta,
    };

    return res.status(options.statusCode ?? 200).json(body);
  }

  /**
   * Sends a failure JSON response.
   */
  public static failure(
    res: Response,
    options: {
      message: string;
      statusCode: number;
      errors: ErrorDetail[];
      requestId: string;
    },
  ): Response {
    const body: FailureResponseBody = {
      success: false,
      message: options.message,
      errors: options.errors,
      meta: {
        requestId: options.requestId,
        timestamp: nowIso(),
      },
    };

    return res.status(options.statusCode).json(body);
  }
}
