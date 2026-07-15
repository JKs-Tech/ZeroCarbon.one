import type { DocumentCategoryValue } from '../ai.constants';
import type { ClassificationResult } from '../interfaces/classification-result.interface';
import type { VendorResult } from '../interfaces/vendor-result.interface';
import type { ExtractionResult } from '../interfaces/extraction-result.interface';

/**
 * Shared chat completion request used by provider adapters.
 */
export interface AiChatRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Shared chat completion response from provider adapters.
 */
export interface AiChatResponse {
  content: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs: number;
}

/**
 * Provider-independent AI capabilities.
 * Business modules and tasks MUST depend only on this interface.
 */
export interface AiProvider {
  readonly name: string;
  readonly model: string;

  classifyDocument(ocrText: string): Promise<ClassificationResult>;
  identifyVendor(ocrText: string): Promise<VendorResult>;
  extractFields(
    ocrText: string,
    documentType: DocumentCategoryValue,
    vendor: string,
  ): Promise<ExtractionResult>;
}
