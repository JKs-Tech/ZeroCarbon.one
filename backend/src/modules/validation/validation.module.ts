/**
 * Validation module — Phase 8 deterministic warnings over AI extraction.
 */
export { ValidationService } from './validation.service';
export type {
  ValidationResult,
  ValidationWarning,
  ValidationInput,
} from './interfaces/validation-result.interface';
export { WarningSeverity, ValidationWarningCode } from './validation.constants';
export type { WarningSeverityValue, ValidationWarningCodeValue } from './validation.constants';
