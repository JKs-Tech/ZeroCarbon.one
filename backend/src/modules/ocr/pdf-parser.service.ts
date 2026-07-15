import { PDFParse } from 'pdf-parse';
import type { LoggerService } from '../logger';

export interface PdfParseResult {
  text: string;
  pageCount: number;
}

/**
 * Responsibility: Direct text extraction from PDFs via pdf-parse.
 * Does not OCR — born-digital PDF text only.
 */
export class PdfParserService {
  public constructor(private readonly logger: LoggerService) {}

  /**
   * Extracts selectable text from a PDF buffer.
   */
  public async extractText(buffer: Buffer): Promise<PdfParseResult> {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = normalizePdfText(result.text ?? '');
      const pageCount = result.total || result.pages?.length || 1;

      this.logger.debug('PDF direct text extracted', {
        pageCount,
        length: text.length,
      });

      return { text, pageCount };
    } catch (error) {
      this.logger.warn('PDF direct text extraction failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      throw new Error(
        `Corrupted or unreadable PDF: ${error instanceof Error ? error.message : 'parse failed'}`,
      );
    }
  }
}

/**
 * Strips pdf-parse page markers and null bytes for cleaner stored text.
 */
function normalizePdfText(raw: string): string {
  return raw
    .replace(/\u0000/g, '')
    .replace(/\n*--\s*\d+\s+of\s+\d+\s*--\n*/gi, '\n')
    .trim();
}
