import { randomUUID } from 'crypto';

/**
 * Generates a UUID v4 string for request IDs and correlation.
 */
export function createUuid(): string {
  return randomUUID();
}
