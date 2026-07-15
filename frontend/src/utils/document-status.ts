import { DocumentProcessingStatus } from '../constants';

const TERMINAL = new Set<string>([
  DocumentProcessingStatus.WAITING_FOR_REVIEW,
  DocumentProcessingStatus.APPROVED,
  DocumentProcessingStatus.FAILED,
]);

const PIPELINE_ORDER: string[] = [
  DocumentProcessingStatus.UPLOADED,
  DocumentProcessingStatus.QUEUED,
  DocumentProcessingStatus.PROCESSING,
  DocumentProcessingStatus.OCR_PROCESSING,
  DocumentProcessingStatus.OCR_COMPLETED,
  DocumentProcessingStatus.AI_PROCESSING,
  DocumentProcessingStatus.AI_COMPLETED,
  DocumentProcessingStatus.VALIDATING,
  DocumentProcessingStatus.VALIDATION_COMPLETED,
  DocumentProcessingStatus.WAITING_FOR_REVIEW,
  DocumentProcessingStatus.APPROVED,
];

const STATUS_LABELS: Record<string, string> = {
  [DocumentProcessingStatus.UPLOADED]: 'Uploaded',
  [DocumentProcessingStatus.QUEUED]: 'Queued',
  [DocumentProcessingStatus.PROCESSING]: 'Processing',
  [DocumentProcessingStatus.OCR_PROCESSING]: 'OCR processing',
  [DocumentProcessingStatus.OCR_COMPLETED]: 'OCR completed',
  [DocumentProcessingStatus.AI_PROCESSING]: 'AI processing',
  [DocumentProcessingStatus.AI_COMPLETED]: 'AI completed',
  [DocumentProcessingStatus.VALIDATING]: 'Validating',
  [DocumentProcessingStatus.VALIDATION_COMPLETED]: 'Validation completed',
  [DocumentProcessingStatus.WAITING_FOR_REVIEW]: 'Waiting for review',
  [DocumentProcessingStatus.APPROVED]: 'Approved',
  [DocumentProcessingStatus.FAILED]: 'Failed',
  NOT_READY: 'Not ready',
};

/** Turns API enums like OCR_COMPLETED into "OCR completed" — never show underscores in UI. */
export function humanizeStatus(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'Unknown';
  }
  if (STATUS_LABELS[trimmed]) {
    return STATUS_LABELS[trimmed];
  }
  return trimmed
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\bocr\b/gi, 'OCR')
    .replace(/\bai\b/gi, 'AI')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bOcr\b/g, 'OCR')
    .replace(/\bAi\b/g, 'AI');
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL.has(status);
}

export function isProcessingStatus(status: string): boolean {
  return !isTerminalStatus(status);
}

export function statusLabel(status: string): string {
  return humanizeStatus(status);
}

/** 0–100 progress through upload → OCR → AI → validation → review. */
export function pipelineProgress(status: string): number {
  if (status === DocumentProcessingStatus.FAILED) {
    return 100;
  }
  const index = PIPELINE_ORDER.indexOf(status);
  if (index < 0) {
    return 0;
  }
  return Math.round((index / (PIPELINE_ORDER.length - 1)) * 100);
}

export function pipelineStage(status: string): 'upload' | 'ocr' | 'ai' | 'validation' | 'review' | 'done' | 'failed' {
  if (status === DocumentProcessingStatus.FAILED) {
    return 'failed';
  }
  if (status === DocumentProcessingStatus.APPROVED) {
    return 'done';
  }
  if (status === DocumentProcessingStatus.WAITING_FOR_REVIEW) {
    return 'review';
  }
  if (
    status === DocumentProcessingStatus.VALIDATING ||
    status === DocumentProcessingStatus.VALIDATION_COMPLETED
  ) {
    return 'validation';
  }
  if (
    status === DocumentProcessingStatus.AI_PROCESSING ||
    status === DocumentProcessingStatus.AI_COMPLETED
  ) {
    return 'ai';
  }
  if (
    status === DocumentProcessingStatus.OCR_PROCESSING ||
    status === DocumentProcessingStatus.OCR_COMPLETED
  ) {
    return 'ocr';
  }
  return 'upload';
}
