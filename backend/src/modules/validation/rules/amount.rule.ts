import { ValidationWarningCode, WarningSeverity } from '../validation.constants';
import type { ValidationWarning } from '../interfaces/validation-result.interface';
import { getField, parseNumeric } from '../validation.helpers';

/**
 * Invalid numeric values — negatives and extreme magnitudes.
 */
export function validateAmounts(
  fields: Record<string, string | number | null>,
  limits: {
    maxAllowedAmount: number;
    maxAllowedConsumption: number;
    maxAllowedQuantity: number;
  },
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const amountFields = [
    { key: 'Total Bill Amount', negativeCode: ValidationWarningCode.NEGATIVE_AMOUNT },
    { key: 'Total Amount', negativeCode: ValidationWarningCode.NEGATIVE_AMOUNT },
    { key: 'Rate Per Litre', negativeCode: ValidationWarningCode.NEGATIVE_RATE },
  ] as const;

  for (const spec of amountFields) {
    const numeric = parseNumeric(getField(fields, spec.key));
    if (numeric === null) {
      continue;
    }
    if (numeric < 0) {
      warnings.push({
        code: spec.negativeCode,
        severity: WarningSeverity.HIGH,
        message: `${spec.key} is negative.`,
        field: spec.key,
      });
    } else if (
      (spec.key === 'Total Bill Amount' || spec.key === 'Total Amount') &&
      numeric > limits.maxAllowedAmount
    ) {
      warnings.push({
        code: ValidationWarningCode.AMOUNT_EXCEEDS_MAX,
        severity: WarningSeverity.MEDIUM,
        message: `${spec.key} exceeds configured maximum (${limits.maxAllowedAmount}).`,
        field: spec.key,
      });
    }
  }

  const gst = parseNumeric(getField(fields, 'GST Amount'));
  if (gst !== null && gst < 0) {
    warnings.push({
      code: ValidationWarningCode.NEGATIVE_GST,
      severity: WarningSeverity.HIGH,
      message: 'GST amount is negative.',
      field: 'GST Amount',
    });
  }

  const consumptionFields = [
    { key: 'Units Consumed (kWh)', label: 'consumption' },
    { key: 'Consumption Volume', label: 'consumption' },
  ] as const;

  for (const spec of consumptionFields) {
    const numeric = parseNumeric(getField(fields, spec.key));
    if (numeric === null) {
      continue;
    }
    if (numeric < 0) {
      warnings.push({
        code: ValidationWarningCode.NEGATIVE_CONSUMPTION,
        severity: WarningSeverity.HIGH,
        message: `${spec.key} is negative.`,
        field: spec.key,
      });
    } else if (numeric > limits.maxAllowedConsumption) {
      warnings.push({
        code: ValidationWarningCode.CONSUMPTION_EXCEEDS_MAX,
        severity: WarningSeverity.MEDIUM,
        message: `${spec.key} exceeds configured maximum (${limits.maxAllowedConsumption}).`,
        field: spec.key,
      });
    }
  }

  const quantityFields = ['Quantity (Litres)', 'Quantity (Tonnes)'] as const;
  for (const key of quantityFields) {
    const numeric = parseNumeric(getField(fields, key));
    if (numeric === null) {
      continue;
    }
    if (numeric < 0) {
      warnings.push({
        code: ValidationWarningCode.NEGATIVE_QUANTITY,
        severity: WarningSeverity.HIGH,
        message: `${key} is negative.`,
        field: key,
      });
    } else if (numeric > limits.maxAllowedQuantity) {
      warnings.push({
        code: ValidationWarningCode.QUANTITY_EXCEEDS_MAX,
        severity: WarningSeverity.MEDIUM,
        message: `${key} exceeds configured maximum (${limits.maxAllowedQuantity}).`,
        field: key,
      });
    }
  }

  return warnings;
}
