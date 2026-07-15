import { ErrorCode, type ErrorCodeValue } from '../constants/error-codes';
import type { ErrorDetail } from '../types/api.types';

/**
 * Base application exception.
 * All domain HTTP errors extend this class and are mapped by the global error handler.
 */
export abstract class AppException extends Error {
  /** HTTP status code to return. */
  public readonly statusCode: number;

  /** Machine-readable error code. */
  public readonly code: ErrorCodeValue;

  /** Optional field-level or additional error details. */
  public readonly details: ErrorDetail[];

  /** Whether this error is expected operational behavior (vs programmer bug). */
  public readonly isOperational: boolean;

  protected constructor(
    message: string,
    statusCode: number,
    code: ErrorCodeValue,
    details: ErrorDetail[] = [],
    isOperational = true,
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, new.target);
  }
}

/**
 * Thrown when request input fails schema or domain preconditions (HTTP 400).
 */
export class ValidationException extends AppException {
  public constructor(message = 'Validation failed', details: ErrorDetail[] = []) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, details);
  }
}

/**
 * Thrown when authentication is missing or invalid (HTTP 401).
 */
export class UnauthorizedException extends AppException {
  public constructor(message = 'Unauthorized') {
    super(message, 401, ErrorCode.UNAUTHORIZED);
  }
}

/**
 * Thrown when the authenticated principal lacks permission (HTTP 403).
 */
export class ForbiddenException extends AppException {
  public constructor(message = 'Forbidden') {
    super(message, 403, ErrorCode.FORBIDDEN);
  }
}

/**
 * Thrown when a requested resource does not exist (HTTP 404).
 */
export class NotFoundException extends AppException {
  public constructor(message = 'Resource not found') {
    super(message, 404, ErrorCode.NOT_FOUND);
  }
}

/**
 * Thrown on conflicting state transitions or duplicates (HTTP 409).
 */
export class ConflictException extends AppException {
  public constructor(message = 'Conflict') {
    super(message, 409, ErrorCode.CONFLICT);
  }
}

/**
 * Thrown when an upstream dependency is unavailable (HTTP 503).
 */
export class ServiceUnavailableException extends AppException {
  public constructor(message = 'Service unavailable') {
    super(message, 503, ErrorCode.SERVICE_UNAVAILABLE);
  }
}

/**
 * Thrown for unexpected internal failures (HTTP 500).
 */
export class InternalServerException extends AppException {
  public constructor(message = 'Internal server error') {
    super(message, 500, ErrorCode.INTERNAL_ERROR, [], false);
  }
}
