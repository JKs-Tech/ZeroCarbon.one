/**
 * Vendor Agent output.
 */
export interface VendorResult {
  vendor: string;
  confidence: number;
  provider: string;
  model: string;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  rawResponse?: string;
}
