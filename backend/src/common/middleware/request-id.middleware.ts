import type { NextFunction, Request, Response } from 'express';
import { HttpHeader } from '../constants';
import type { AppRequest } from '../types/api.types';
import { createUuid } from '../utils/uuid';

/**
 * Attaches a unique request ID to every request for log/response correlation.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HttpHeader.REQUEST_ID);
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : createUuid();

  (req as AppRequest).requestId = requestId;
  res.setHeader(HttpHeader.REQUEST_ID, requestId);
  next();
}
