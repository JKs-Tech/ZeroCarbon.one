/**
 * Application error codes.
 * Prefer these constants over magic strings.
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BAD_REQUEST: 'BAD_REQUEST',
  INVALID_FILE: 'INVALID_FILE',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * HTTP header names used across the API.
 */
export const HttpHeader = {
  REQUEST_ID: 'x-request-id',
} as const;

/**
 * API path prefixes.
 */
export const ApiPath = {
  ROOT: '/api',
  V1: '/api/v1',
  HEALTH: '/health',
} as const;
