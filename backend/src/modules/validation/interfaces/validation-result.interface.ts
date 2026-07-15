import type {
  ValidationWarningCodeValue,
  WarningSeverityValue,
} from '../validation.constants';

/**
 * A single validation warning — never a hard rejection.
 */
export interface ValidationWarning {
  code: ValidationWarningCodeValue;
  severity: WarningSeverityValue;
  message: string;
  field?: string;
}

/**
 * Aggregate result of the validation engine.
 * Never mutates AI extraction output.
 */
export interface ValidationResult {
  isValid: boolean;
  warningCount: number;
  warnings: ValidationWarning[];
  summary: string;
  processingTimeMs: number;
}

/**
 * Input snapshot for validation (read-only view of AI artifacts).
 */
export interface ValidationInput {
  documentId: string;
  documentType: string;
  vendor: string;
  fields: Record<string, string | number | null>;
}
