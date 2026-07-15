import { ValidationWarningCode, WarningSeverity } from '../validation.constants';
import type { ValidationWarning } from '../interfaces/validation-result.interface';

/**
 * Builds a possible-duplicate warning when peer document ids are found.
 */
export function buildDuplicateWarnings(
  duplicateDocumentIds: string[],
): ValidationWarning[] {
  if (duplicateDocumentIds.length === 0) {
    return [];
  }

  return [
    {
      code: ValidationWarningCode.POSSIBLE_DUPLICATE,
      severity: WarningSeverity.HIGH,
      message: `Possible duplicate of document(s): ${duplicateDocumentIds.join(', ')}.`,
    },
  ];
}
