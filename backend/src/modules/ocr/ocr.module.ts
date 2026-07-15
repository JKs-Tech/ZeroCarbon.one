/**
 * OCR module wiring.
 */
export { OcrService } from './ocr.service';
export { PdfParserService } from './pdf-parser.service';
export { ImageConverterService } from './image-converter.service';
export { TesseractService } from './tesseract.service';
export { QualityEvaluatorService } from './quality-evaluator.service';
export { OcrMethod, OCR_PAGE_SEPARATOR } from './ocr.constants';
export type { OcrMethodValue } from './ocr.constants';
export type {
  OcrExtractInput,
  OcrExtractResult,
  TextQualityEvaluation,
  PageOcrResult,
} from './ocr.types';
