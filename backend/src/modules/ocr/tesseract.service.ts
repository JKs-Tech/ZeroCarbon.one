import Tesseract from 'tesseract.js';
import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';
import type { PageOcrResult } from './ocr.types';

/**
 * Responsibility: Run Tesseract OCR on image files/buffers.
 * Processes pages sequentially to limit memory — never batches entire PDFs into RAM.
 */
export class TesseractService {
  public constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * OCRs a list of image paths in page order.
   */
  public async recognizePages(imagePaths: string[]): Promise<PageOcrResult[]> {
    const results: PageOcrResult[] = [];

    for (let index = 0; index < imagePaths.length; index += 1) {
      const imagePath = imagePaths[index];
      const pageNumber = index + 1;
      const page = await this.recognizeImage(imagePath, pageNumber);
      results.push(page);
      // Yield so BullMQ can renew job locks between CPU-heavy pages.
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    return results;
  }

  /**
   * OCRs a single image path with configured language.
   */
  public async recognizeImage(imagePath: string, pageNumber: number): Promise<PageOcrResult> {
    try {
      const result = await Tesseract.recognize(imagePath, this.config.ocr.language, {
        logger: () => undefined,
      });

      const text = (result.data.text ?? '').replace(/\u0000/g, '').trim();
      const confidence =
        typeof result.data.confidence === 'number' ? result.data.confidence : undefined;

      this.logger.debug('Tesseract page complete', {
        pageNumber,
        length: text.length,
        confidence,
      });

      return { pageNumber, text, confidence };
    } catch (error) {
      this.logger.warn('Tesseract failed for page', {
        pageNumber,
        imagePath,
        error: error instanceof Error ? error.message : 'unknown',
      });
      throw new Error(
        `Unreadable image or OCR failure on page ${pageNumber}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  /**
   * Average confidence across pages (0–100 scale from Tesseract).
   */
  public averageConfidence(pages: PageOcrResult[]): number | undefined {
    const scores = pages
      .map((page) => page.confidence)
      .filter((value): value is number => typeof value === 'number');

    if (scores.length === 0) {
      return undefined;
    }

    return Number(
      (scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2),
    );
  }
}
