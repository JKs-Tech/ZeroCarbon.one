import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';
import { AllowedUploadMime } from '../../common/constants';
import { OCR_PAGE_SEPARATOR, OcrMethod } from './ocr.constants';
import type { OcrExtractInput, OcrExtractResult } from './ocr.types';
import { PdfParserService } from './pdf-parser.service';
import { QualityEvaluatorService } from './quality-evaluator.service';
import { ImageConverterService } from './image-converter.service';
import { TesseractService } from './tesseract.service';

/**
 * Responsibility: Hybrid OCR orchestration — Document in, plain text out.
 * Independent of AI / Validation / Classification.
 *
 * Strategy:
 * 1. PDF → pdf-parse direct text
 * 2. If quality poor → rasterize pages → Tesseract
 * 3. Images → Tesseract directly
 * 4. Merge pages into one text document
 */
export class OcrService {
  private readonly pdfParser: PdfParserService;
  private readonly qualityEvaluator: QualityEvaluatorService;
  private readonly imageConverter: ImageConverterService;
  private readonly tesseract: TesseractService;

  public constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    const ocrLogger = logger.child('Ocr');
    this.pdfParser = new PdfParserService(ocrLogger);
    this.qualityEvaluator = new QualityEvaluatorService(config);
    this.imageConverter = new ImageConverterService(config, ocrLogger);
    this.tesseract = new TesseractService(config, ocrLogger);
  }

  /**
   * Extracts plain text from an uploaded document buffer.
   */
  public async extract(input: OcrExtractInput): Promise<OcrExtractResult> {
    const startedAt = Date.now();
    const workerId = process.pid;

    this.logger.info('OCR started', {
      documentId: input.documentId,
      mimeType: input.mimeType,
      workerId,
      size: input.fileBuffer.length,
    });

    try {
      const result = await this.withTimeout(
        this.extractInternal(input),
        this.config.ocr.timeoutMs,
        `OCR timed out after ${this.config.ocr.timeoutMs}ms`,
      );

      const durationMs = Date.now() - startedAt;

      this.logger.info('OCR finished', {
        documentId: input.documentId,
        workerId,
        method: result.method,
        fallbackTriggered: result.fallbackTriggered,
        confidence: result.confidence,
        pageCount: result.pageCount,
        durationMs,
        textLength: result.text.length,
      });

      return { ...result, durationMs };
    } catch (error) {
      this.logger.error('OCR failed', {
        documentId: input.documentId,
        workerId,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'unknown',
      });
      throw error;
    }
  }

  private async extractInternal(input: OcrExtractInput): Promise<Omit<OcrExtractResult, 'durationMs'>> {
    const mime = input.mimeType.toLowerCase();

    if (mime === AllowedUploadMime.PDF) {
      return this.extractFromPdf(input);
    }

    if (
      mime === AllowedUploadMime.PNG ||
      mime === AllowedUploadMime.JPEG
    ) {
      return this.extractFromImage(input);
    }

    throw new Error(`Unsupported format for OCR: ${input.mimeType}`);
  }

  private async extractFromPdf(
    input: OcrExtractInput,
  ): Promise<Omit<OcrExtractResult, 'durationMs'>> {
    let directText = '';
    let pageCount = 1;

    try {
      const parsed = await this.pdfParser.extractText(input.fileBuffer);
      directText = parsed.text;
      pageCount = parsed.pageCount;
    } catch {
      this.logger.info('OCR fallback triggered', {
        documentId: input.documentId,
        reason: 'pdf_parse_failed',
      });
      return this.runTesseractOnPdf(input.fileBuffer, input.documentId);
    }

    const quality = this.qualityEvaluator.evaluate(directText);

    this.logger.info('OCR method', {
      documentId: input.documentId,
      method: OcrMethod.DIRECT_TEXT,
      qualityScore: quality.score,
      acceptable: quality.acceptable,
      reasons: quality.reasons,
    });

    if (quality.acceptable) {
      return {
        text: directText,
        method: OcrMethod.DIRECT_TEXT,
        pageCount,
        qualityScore: quality.score,
        fallbackTriggered: false,
      };
    }

    this.logger.info('OCR fallback triggered', {
      documentId: input.documentId,
      reason: 'quality_below_threshold',
      qualityScore: quality.score,
      reasons: quality.reasons,
    });

    return this.runTesseractOnPdf(input.fileBuffer, input.documentId, quality.score);
  }

  private async extractFromImage(
    input: OcrExtractInput,
  ): Promise<Omit<OcrExtractResult, 'durationMs'>> {
    const extension =
      input.mimeType === AllowedUploadMime.PNG ? '.png' : '.jpg';

    let workDir: string | undefined;

    try {
      const materialized = await this.imageConverter.materializeImageBuffer(
        input.fileBuffer,
        extension,
      );
      workDir = materialized.workDir;

      let pages = await this.tesseract.recognizePages(materialized.imagePaths);
      let text = mergePageTexts(pages.map((page) => page.text));
      let confidence = this.tesseract.averageConfidence(pages);

      // Dense scanned bills often need a sharper raster — for PNG uploads we already
      // have the image; for PDF children this path is used after split at configured DPI.
      if (
        confidence !== undefined &&
        confidence < this.config.ocr.confidenceRetryThreshold &&
        text.trim().length < this.config.ocr.minTextLength * 3
      ) {
        this.logger.info('OCR low confidence on image — keeping best available text', {
          documentId: input.documentId,
          confidence,
          threshold: this.config.ocr.confidenceRetryThreshold,
        });
      }

      this.logger.info('OCR method', {
        documentId: input.documentId,
        method: OcrMethod.TESSERACT,
        pageCount: pages.length,
        confidence,
      });

      return {
        text,
        method: OcrMethod.TESSERACT,
        confidence,
        pageCount: pages.length,
        fallbackTriggered: false,
        pageImage: {
          mimeType: input.mimeType === AllowedUploadMime.PNG ? 'image/png' : 'image/jpeg',
          buffer: input.fileBuffer,
        },
      };
    } finally {
      if (workDir) {
        await this.imageConverter.cleanup(workDir);
      }
    }
  }

  private async runTesseractOnPdf(
    pdfBuffer: Buffer,
    documentId: string,
    priorQualityScore?: number,
  ): Promise<Omit<OcrExtractResult, 'durationMs'>> {
    let workDir: string | undefined;
    let retryDir: string | undefined;

    try {
      const converted = await this.imageConverter.convertPdfToImages(pdfBuffer);
      workDir = converted.workDir;

      let pages = await this.tesseract.recognizePages(converted.imagePaths);
      let text = mergePageTexts(pages.map((page) => page.text));
      let confidence = this.tesseract.averageConfidence(pages);
      let winningImagePaths = converted.imagePaths;

      if (
        confidence !== undefined &&
        confidence < this.config.ocr.confidenceRetryThreshold
      ) {
        this.logger.info('OCR confidence retry at higher DPI', {
          documentId,
          confidence,
          threshold: this.config.ocr.confidenceRetryThreshold,
          retryDpi: this.config.ocr.retryRasterDpi,
        });

        const retry = await this.imageConverter.convertPdfToImages(pdfBuffer, {
          dpi: this.config.ocr.retryRasterDpi,
        });
        retryDir = retry.workDir;
        const retryPages = await this.tesseract.recognizePages(retry.imagePaths);
        const retryText = mergePageTexts(retryPages.map((page) => page.text));
        const retryConfidence = this.tesseract.averageConfidence(retryPages);

        if (
          retryText.trim().length > text.trim().length ||
          (retryConfidence ?? 0) > (confidence ?? 0)
        ) {
          pages = retryPages;
          text = retryText;
          confidence = retryConfidence;
          winningImagePaths = retry.imagePaths;
        }
      }

      let pageImage: { mimeType: 'image/png'; buffer: Buffer } | undefined;
      if (winningImagePaths[0]) {
        pageImage = {
          mimeType: 'image/png',
          buffer: await this.imageConverter.readImage(winningImagePaths[0]),
        };
      }

      this.logger.info('OCR method', {
        documentId,
        method: OcrMethod.TESSERACT,
        pageCount: pages.length,
        confidence,
        fallbackTriggered: true,
        hasPageImage: Boolean(pageImage),
      });

      return {
        text,
        method: OcrMethod.TESSERACT,
        confidence,
        pageCount: pages.length,
        qualityScore: priorQualityScore,
        fallbackTriggered: true,
        pageImage,
      };
    } finally {
      if (workDir) {
        await this.imageConverter.cleanup(workDir);
      }
      if (retryDir) {
        await this.imageConverter.cleanup(retryDir);
      }
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}

function mergePageTexts(pageTexts: string[]): string {
  return pageTexts
    .map((text, index) => {
      const body = text.trim();
      if (!body) {
        return `----- PAGE ${index + 1} (empty) -----`;
      }
      return `----- PAGE ${index + 1} -----\n${body}`;
    })
    .join(OCR_PAGE_SEPARATOR)
    .trim();
}
