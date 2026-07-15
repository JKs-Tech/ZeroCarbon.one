import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async Express handler so rejected promises reach the error middleware.
 *
 * @param handler - Async route handler
 * @returns Express-compatible request handler
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    void handler(req, res, next).catch(next);
  };
}
