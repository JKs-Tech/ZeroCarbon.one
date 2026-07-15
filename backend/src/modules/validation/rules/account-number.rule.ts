import { DocumentCategory } from '../../ai';
import { ValidationWarningCode, WarningSeverity } from '../validation.constants';
import type { ValidationWarning } from '../interfaces/validation-result.interface';
import { getField, isMissing } from '../validation.helpers';

/**
 * Soft account/consumer identifier checks for electricity bills.
 * Format validation is intentionally light — human review decides later.
 */
export function validateAccountNumber(
  documentType: string,
  fields: Record<string, string | number | null>,
): ValidationWarning[] {
  if (documentType !== DocumentCategory.ELECTRICITY_BILL) {
    return [];
  }

  const warnings: ValidationWarning[] = [];
  const consumer = getField(fields, 'Consumer Number');
  const account = getField(fields, 'Account Number');

  if (!isMissing(consumer)) {
    const text = String(consumer).trim();
    if (text.length < 3) {
      warnings.push({
        code: ValidationWarningCode.MISSING_CONSUMER_NUMBER,
        severity: WarningSeverity.LOW,
        message: 'Consumer number looks unusually short.',
        field: 'Consumer Number',
      });
    }
  }

  if (!isMissing(account)) {
    const text = String(account).trim();
    if (text.length < 3) {
      warnings.push({
        code: ValidationWarningCode.MISSING_ACCOUNT_NUMBER,
        severity: WarningSeverity.LOW,
        message: 'Account number looks unusually short.',
        field: 'Account Number',
      });
    }
  }

  return warnings;
}
