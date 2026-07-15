import type { DocumentCategoryValue } from '../ai.constants';
import { AiPermanentError } from '../ai.errors';
import type { ClassificationResult } from '../interfaces/classification-result.interface';
import type { ExtractionResult } from '../interfaces/extraction-result.interface';
import type { VendorResult } from '../interfaces/vendor-result.interface';
import type { AiProvider } from './ai-provider.interface';

/**
 * Shared stub for providers that are registered but not yet implemented.
 */
export abstract class StubAiProvider implements AiProvider {
  public abstract readonly name: string;
  public abstract readonly model: string;

  public classifyDocument(_ocrText: string): Promise<ClassificationResult> {
    return Promise.reject(this.notImplemented());
  }

  public identifyVendor(_ocrText: string): Promise<VendorResult> {
    return Promise.reject(this.notImplemented());
  }

  public extractFields(
    _ocrText: string,
    _documentType: DocumentCategoryValue,
    _vendor: string,
  ): Promise<ExtractionResult> {
    return Promise.reject(this.notImplemented());
  }

  private notImplemented(): AiPermanentError {
    return new AiPermanentError(
      `AI provider "${this.name}" is registered but not implemented yet. Set AI_PROVIDER=openai.`,
    );
  }
}
