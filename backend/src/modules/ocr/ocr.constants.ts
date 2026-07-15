/**
 * OCR method identifiers persisted on document.ocr.method.
 */
export const OcrMethod = {
  DIRECT_TEXT: 'DIRECT_TEXT',
  TESSERACT: 'TESSERACT',
} as const;

export type OcrMethodValue = (typeof OcrMethod)[keyof typeof OcrMethod];

/**
 * Page separator used when merging multi-page OCR text.
 */
export const OCR_PAGE_SEPARATOR = '\n\n----- PAGE BREAK -----\n\n';
