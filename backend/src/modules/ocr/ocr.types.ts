import type { OcrMethodValue } from './ocr.constants';

/**
 * Input for OCR extraction — document bytes + type only.
 * OCR does not know about AI, validation, or business rules.
 */
export interface OcrExtractInput {
  documentId: string;
  mimeType: string;
  fileBuffer: Buffer;
  originalFileName?: string;
}

/**
 * Result of hybrid OCR — one merged plain-text document plus metadata.
 */
export interface OcrExtractResult {
  text: string;
  method: OcrMethodValue;
  confidence?: number;
  durationMs: number;
  pageCount: number;
  qualityScore?: number;
  fallbackTriggered: boolean;
}

/**
 * Deterministic quality evaluation of extracted PDF text.
 */
export interface TextQualityEvaluation {
  acceptable: boolean;
  score: number;
  metrics: {
    length: number;
    alphanumericRatio: number;
    whitespaceRatio: number;
    readableWordCount: number;
    empty: boolean;
  };
  reasons: string[];
}

/**
 * Single page OCR output from Tesseract.
 */
export interface PageOcrResult {
  pageNumber: number;
  text: string;
  confidence?: number;
}
