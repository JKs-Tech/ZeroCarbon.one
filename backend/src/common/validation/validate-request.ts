import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationException } from '../exceptions';
import type { ErrorDetail } from '../types/api.types';

type RequestSegment = 'body' | 'query' | 'params';

/**
 * Creates Express middleware that validates a request segment with a Zod schema.
 * No business validation — structural request validation only.
 *
 * @param schema - Zod schema
 * @param segment - Which part of the request to validate
 */
export function validateRequest<T>(
  schema: ZodSchema<T>,
  segment: RequestSegment = 'body',
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[segment]);

    if (!result.success) {
      const details: ErrorDetail[] = result.error.issues.map((issue) => ({
        code: 'VALIDATION_ERROR',
        message: issue.message,
        field: issue.path.join('.') || undefined,
      }));

      next(new ValidationException('Request validation failed', details));
      return;
    }

    // Replace with parsed/coerced values (strip unknown keys via schema).
    (req as Request & Record<RequestSegment, T>)[segment] = result.data;
    next();
  };
}
