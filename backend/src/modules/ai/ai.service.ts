import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';
import { AiPermanentError, AiTransientError } from './ai.errors';
import { assertNonEmptyOcr } from './ai.json';
import type { ClassificationResult } from './interfaces/classification-result.interface';
import type { ExtractionResult } from './interfaces/extraction-result.interface';
import type { VendorResult } from './interfaces/vendor-result.interface';
import type { AiProvider } from './providers/ai-provider.interface';
import { AiProviderFactory } from './providers/ai-provider.factory';
import { ClassificationTask } from './tasks/classification.task';
import { FieldExtractionTask } from './tasks/field-extraction.task';
import { VendorDetectionTask } from './tasks/vendor-detection.task';

export interface AiPipelineContext {
  documentId: string;
  workerId?: number;
}

export interface AiPipelineResult {
  classification: ClassificationResult;
  vendor: VendorResult;
  extraction: ExtractionResult;
  totalDurationMs: number;
  provider: string;
  model: string;
}

/**
 * Business orchestration for the agentic AI pipeline.
 * Coordinates independent agents sequentially; does not call vendor SDKs.
 */
export class AiService {
  private readonly provider: AiProvider;
  private readonly classificationTask: ClassificationTask;
  private readonly vendorTask: VendorDetectionTask;
  private readonly extractionTask: FieldExtractionTask;
  private readonly maxRetries: number;

  public constructor(
    config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.provider = AiProviderFactory.create(config, logger);
    this.maxRetries = config.ai.maxRetries;
    this.classificationTask = new ClassificationTask(this.provider, logger.child('ClassificationAgent'));
    this.vendorTask = new VendorDetectionTask(this.provider, logger.child('VendorAgent'));
    this.extractionTask = new FieldExtractionTask(this.provider, logger.child('ExtractionAgent'));

    this.logger.info('AiService initialized', {
      provider: this.provider.name,
      model: this.provider.model,
      maxRetries: this.maxRetries,
    });
  }

  /**
   * Runs Classification → Vendor → Extraction on OCR text.
   * Stops after structured extraction (no validation).
   */
  public async processOcrText(
    ocrText: string,
    context: AiPipelineContext,
  ): Promise<AiPipelineResult> {
    const startedAt = Date.now();
    const workerId = context.workerId ?? process.pid;

    assertNonEmptyOcr(ocrText);

    this.logger.info('AI pipeline started', {
      documentId: context.documentId,
      workerId,
      provider: this.provider.name,
      model: this.provider.model,
      ocrChars: ocrText.length,
    });

    const agentContext = { documentId: context.documentId, workerId };

    const classification = await this.withRetries(
      'classification',
      context.documentId,
      () => this.classificationTask.run(ocrText, agentContext),
    );

    const vendor = await this.withRetries(
      'vendor',
      context.documentId,
      () => this.vendorTask.run(ocrText, agentContext),
    );

    const extraction = await this.withRetries(
      'extraction',
      context.documentId,
      () =>
        this.extractionTask.run(
          ocrText,
          classification.documentType,
          vendor.vendor,
          agentContext,
        ),
    );

    const totalDurationMs = Date.now() - startedAt;

    this.logger.info('AI pipeline completed', {
      documentId: context.documentId,
      workerId,
      provider: this.provider.name,
      model: this.provider.model,
      documentType: classification.documentType,
      vendor: vendor.vendor,
      totalDurationMs,
      promptTokens:
        (classification.promptTokens ?? 0) +
        (vendor.promptTokens ?? 0) +
        (extraction.promptTokens ?? 0),
      completionTokens:
        (classification.completionTokens ?? 0) +
        (vendor.completionTokens ?? 0) +
        (extraction.completionTokens ?? 0),
    });

    return {
      classification,
      vendor,
      extraction,
      totalDurationMs,
      provider: this.provider.name,
      model: this.provider.model,
    };
  }

  private async withRetries<T>(
    step: string,
    documentId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (error instanceof AiPermanentError) {
          throw error;
        }

        const isTransient = error instanceof AiTransientError;
        const canRetry = isTransient && attempt < this.maxRetries;

        this.logger.warn('AI step failed', {
          documentId,
          step,
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          willRetry: canRetry,
          error: error instanceof Error ? error.message : 'unknown',
        });

        if (!canRetry) {
          if (error instanceof AiTransientError) {
            throw new AiPermanentError(
              `AI ${step} failed after ${attempt + 1} attempt(s): ${error.message}`,
            );
          }
          throw error;
        }

        attempt += 1;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new AiPermanentError(`AI ${step} failed`);
  }
}
