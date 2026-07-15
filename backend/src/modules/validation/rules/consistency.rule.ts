import { ValidationWarningCode, WarningSeverity } from '../validation.constants';
import type { ValidationWarning } from '../interfaces/validation-result.interface';
import { getField, parseNumeric } from '../validation.helpers';

/**
 * Cross-field / suspicious value consistency checks.
 */
export function validateConsistency(
  fields: Record<string, string | number | null>,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const total =
    parseNumeric(getField(fields, 'Total Bill Amount')) ??
    parseNumeric(getField(fields, 'Total Amount'));
  const gst = parseNumeric(getField(fields, 'GST Amount'));

  if (total !== null && gst !== null && gst > total) {
    warnings.push({
      code: ValidationWarningCode.GST_EXCEEDS_TOTAL,
      severity: WarningSeverity.HIGH,
      message: 'GST amount is greater than total amount.',
      field: 'GST Amount',
    });
  }

  const consumption =
    parseNumeric(getField(fields, 'Units Consumed (kWh)')) ??
    parseNumeric(getField(fields, 'Consumption Volume'));

  if (consumption === 0) {
    warnings.push({
      code: ValidationWarningCode.ZERO_CONSUMPTION,
      severity: WarningSeverity.MEDIUM,
      message: 'Consumption equals zero.',
      field: getField(fields, 'Units Consumed (kWh)') !== undefined
        ? 'Units Consumed (kWh)'
        : 'Consumption Volume',
    });
  }

  const quantity =
    parseNumeric(getField(fields, 'Quantity (Litres)')) ??
    parseNumeric(getField(fields, 'Quantity (Tonnes)'));

  if (quantity === 0) {
    warnings.push({
      code: ValidationWarningCode.ZERO_QUANTITY,
      severity: WarningSeverity.MEDIUM,
      message: 'Quantity equals zero.',
      field:
        getField(fields, 'Quantity (Litres)') !== undefined
          ? 'Quantity (Litres)'
          : 'Quantity (Tonnes)',
    });
  }

  return warnings;
}
