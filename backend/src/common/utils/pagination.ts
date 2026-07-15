import type { PaginationMeta, PaginationQuery } from '../types/api.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Normalizes raw pagination query values into safe page/limit integers.
 *
 * @param pageRaw - Raw page value from query string
 * @param limitRaw - Raw limit value from query string
 */
export function parsePagination(
  pageRaw: unknown,
  limitRaw: unknown,
): PaginationQuery {
  const page = clampPositiveInt(pageRaw, DEFAULT_PAGE);
  const limit = Math.min(clampPositiveInt(limitRaw, DEFAULT_LIMIT), MAX_LIMIT);

  return { page, limit };
}

/**
 * Builds Mongo-style skip/limit from a pagination query.
 */
export function toSkipTake(pagination: PaginationQuery): { skip: number; limit: number } {
  return {
    skip: (pagination.page - 1) * pagination.limit,
    limit: pagination.limit,
  };
}

/**
 * Builds pagination metadata for list responses.
 */
export function buildPaginationMeta(
  pagination: PaginationQuery,
  total: number,
): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.limit);

  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages,
  };
}

function clampPositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}
