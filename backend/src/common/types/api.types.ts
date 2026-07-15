import type { Request } from 'express';
import type { RoleValue } from '../constants/roles';

/**
 * Authenticated principal attached by JWT middleware.
 * Never includes passwordHash.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: RoleValue;
}

/**
 * Express Request augmented with correlation and auth context.
 */
export interface AppRequest extends Request {
  /** Unique ID for request correlation across logs and responses. */
  requestId: string;
  /** Present after successful JWT authentication. */
  user?: AuthenticatedUser;
}


/**
 * Standard pagination query shape.
 */
export interface PaginationQuery {
  page: number;
  limit: number;
}

/**
 * Computed pagination metadata for list responses.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Field-level or domain error detail for failure responses.
 */
export interface ErrorDetail {
  code: string;
  message: string;
  field?: string;
}

/**
 * Success API envelope (Phase 2 + Architecture meta).
 */
export interface SuccessResponseBody<T> {
  success: true;
  message: string;
  data: T;
  meta: ResponseMeta;
}

/**
 * Failure API envelope (Phase 2).
 */
export interface FailureResponseBody {
  success: false;
  message: string;
  errors: ErrorDetail[];
  meta: ResponseMeta;
}

/**
 * Shared response metadata.
 */
export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}
