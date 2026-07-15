/**
 * Transient AI failures (timeout, 429, 5xx) — safe to retry via BullMQ.
 */
export class AiTransientError extends Error {
  public constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AiTransientError';
  }
}

/**
 * Permanent AI / input failures (empty OCR, unparseable after retries).
 */
export class AiPermanentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AiPermanentError';
  }
}
