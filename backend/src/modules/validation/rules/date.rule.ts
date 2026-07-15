import { ValidationWarningCode, WarningSeverity } from '../validation.constants';
import type { ValidationWarning } from '../interfaces/validation-result.interface';
import { getField, parseDate, startOfTodayUtc } from '../validation.helpers';

/**
 * Date sanity checks — future dates are suspicious, not rejectable.
 */
export function validateDates(
  fields: Record<string, string | number | null>,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const today = startOfTodayUtc();

  const billDate = parseDate(getField(fields, 'Bill Date'));
  if (billDate && billDate.getTime() > today.getTime() + 24 * 60 * 60 * 1000) {
    warnings.push({
      code: ValidationWarningCode.FUTURE_BILL_DATE,
      severity: WarningSeverity.MEDIUM,
      message: 'Bill date is in the future.',
      field: 'Bill Date',
    });
  }

  const invoiceDate = parseDate(getField(fields, 'Invoice Date'));
  if (invoiceDate && invoiceDate.getTime() > today.getTime() + 24 * 60 * 60 * 1000) {
    warnings.push({
      code: ValidationWarningCode.FUTURE_INVOICE_DATE,
      severity: WarningSeverity.MEDIUM,
      message: 'Invoice date is in the future.',
      field: 'Invoice Date',
    });
  }

  return warnings;
}
