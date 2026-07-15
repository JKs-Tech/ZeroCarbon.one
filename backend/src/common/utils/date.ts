/**
 * Returns the current time as an ISO-8601 UTC string.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Returns process uptime in whole seconds.
 */
export function uptimeSeconds(): number {
  return Math.floor(process.uptime());
}

/**
 * Formats a duration in milliseconds for logs.
 */
export function formatDurationMs(startedAtMs: number): number {
  return Date.now() - startedAtMs;
}
