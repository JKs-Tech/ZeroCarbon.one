import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';
import {
  OCR_THIN_TEXT_CHARS,
  OCR_VISION_CONFIDENCE_THRESHOLD,
} from './ai.constants';
import { AiPermanentError, AiTransientError } from './ai.errors';
import { assertNonEmptyOcr } from './ai.json';
import type { ClassificationResult } from './interfaces/classification-result.interface';
import type { ExtractionResult } from './interfaces/extraction-result.interface';
import type { VendorResult } from './interfaces/vendor-result.interface';
import type { AiExtractionImage, AiProvider } from './providers/ai-provider.interface';
import { AiProviderFactory } from './providers/ai-provider.factory';
import { ClassificationTask } from './tasks/classification.task';
import { FieldExtractionTask } from './tasks/field-extraction.task';
import { VendorDetectionTask } from './tasks/vendor-detection.task';

export interface AiPipelineContext {
  documentId: string;
  workerId?: number;
  /** OCR method / quality hints for vision routing. */
  ocrMethod?: 'DIRECT_TEXT' | 'TESSERACT';
  ocrConfidence?: number;
  mimeType?: string;
  /** Page image for multimodal extraction (PNG/JPEG bills or split PDF pages). */
  image?: AiExtractionImage;
}

export interface AiPipelineResult {
  classification: ClassificationResult;
  vendor: VendorResult;
  extraction: ExtractionResult;
  totalDurationMs: number;
  provider: string;
  model: string;
  usedVision: boolean;
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
  private readonly visionEnabled: boolean;

  public constructor(
    config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.provider = AiProviderFactory.create(config, logger);
    this.maxRetries = config.ai.maxRetries;
    this.visionEnabled = config.ai.visionEnabled;
    this.classificationTask = new ClassificationTask(this.provider, logger.child('ClassificationAgent'));
    this.vendorTask = new VendorDetectionTask(this.provider, logger.child('VendorAgent'));
    this.extractionTask = new FieldExtractionTask(this.provider, logger.child('ExtractionAgent'));

    this.logger.info('AiService initialized', {
      provider: this.provider.name,
      model: this.provider.model,
      maxRetries: this.maxRetries,
      visionEnabled: this.visionEnabled,
    });
  }

  /**
   * Runs Classification → Vendor → Extraction on OCR text.
   * Optionally attaches a page image for extraction on scanned/image bills.
   */
  public async processOcrText(
    ocrText: string,
    context: AiPipelineContext,
  ): Promise<AiPipelineResult> {
    const startedAt = Date.now();
    const workerId = context.workerId ?? process.pid;

    assertNonEmptyOcr(ocrText);

    const extractionImage = this.resolveExtractionImage(ocrText, context);

    this.logger.info('AI pipeline started', {
      documentId: context.documentId,
      workerId,
      provider: this.provider.name,
      model: this.provider.model,
      ocrChars: ocrText.length,
      ocrMethod: context.ocrMethod,
      ocrConfidence: context.ocrConfidence,
      vision: Boolean(extractionImage),
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
          extractionImage,
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
      usedVision: Boolean(extractionImage),
      fieldCount: Object.keys(extraction.fields).length,
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
      usedVision: Boolean(extractionImage),
    };
  }

  private resolveExtractionImage(
    ocrText: string,
    context: AiPipelineContext,
  ): AiExtractionImage | undefined {
    if (!this.visionEnabled || !context.image?.buffer?.length) {
      return undefined;
    }

    const mime = (context.mimeType ?? context.image.mimeType).toLowerCase();
    const isImageMime = mime === 'image/png' || mime === 'image/jpeg';
    const fromTesseract = context.ocrMethod === 'TESSERACT';
    const weakOcr =
      context.ocrConfidence === undefined ||
      context.ocrConfidence < OCR_VISION_CONFIDENCE_THRESHOLD ||
      ocrText.trim().length < OCR_THIN_TEXT_CHARS;

    // Image uploads, split PDF page PNGs, and scanned PDFs (Tesseract) get vision
    // so the model can recover labels OCR missed. Born-digital DIRECT_TEXT skips vision.
    if (isImageMime || fromTesseract || weakOcr) {
      return context.image;
    }

    return undefined;
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
