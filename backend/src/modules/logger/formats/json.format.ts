/**
 * Formats a log entry as a single-line JSON string for stdout.
 */
export function formatJsonLog(entry: Record<string, unknown>): string {
  return JSON.stringify(entry);
}
