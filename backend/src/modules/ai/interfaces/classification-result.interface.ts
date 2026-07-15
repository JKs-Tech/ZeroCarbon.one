import type { DocumentCategoryValue } from '../ai.constants';

/**
 * Classification Agent output.
 */
export interface ClassificationResult {
  documentType: DocumentCategoryValue;
  confidence: number;
  reasoningSummary: string;
  provider: string;
  model: string;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  rawResponse?: string;
}
