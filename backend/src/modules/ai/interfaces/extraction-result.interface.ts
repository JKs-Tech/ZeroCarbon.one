import type { DocumentCategoryValue } from '../ai.constants';

/**
 * Extraction Agent output — normalized JSON structure.
 */
export interface ExtractionResult {
  documentType: DocumentCategoryValue;
  vendor: string;
  fields: Record<string, string | number | null>;
  /** Overall extraction confidence in [0, 1] (assignment standardized JSON). */
  confidenceScore: number;
  provider: string;
  model: string;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  rawResponse?: string;
}
