import { DocumentCategory } from '../../ai';
import { ALLOWED_UNITS, ValidationWarningCode, WarningSeverity } from '../validation.constants';
import type { ValidationWarning } from '../interfaces/validation-result.interface';
import { getField, isMissing } from '../validation.helpers';

/**
 * Unit checks for water/gas bills and implied units on electricity/fuel fields.
 */
export function validateUnits(
  documentType: string,
  fields: Record<string, string | number | null>,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (
    documentType === DocumentCategory.WATER_BILL ||
    documentType === DocumentCategory.GAS_BILL ||
    documentType === DocumentCategory.LPG_BILL ||
    documentType === DocumentCategory.STEAM_BILL
  ) {
    const unit = getField(fields, 'Unit');
    if (isMissing(unit)) {
      // Required-fields rule already emits MISSING_UNIT; skip duplicate here.
      return warnings;
    }

    const normalized = normalizeUnit(String(unit));
    if (!ALLOWED_UNITS.includes(normalized as (typeof ALLOWED_UNITS)[number])) {
      warnings.push({
        code: ValidationWarningCode.UNKNOWN_UNIT,
        severity: WarningSeverity.MEDIUM,
        message: `Unknown unit "${String(unit)}". Expected one of: kWh, Litres, Tonnes.`,
        field: 'Unit',
      });
    }
  }

  if (documentType === DocumentCategory.ELECTRICITY_BILL) {
    const unitsField = getField(fields, 'Units Consumed (kWh)');
    if (!isMissing(unitsField) && typeof unitsField === 'string') {
      const lower = unitsField.toLowerCase();
      if (
        /(litre|liter|tonne|ton|gallon)/i.test(lower) &&
        !/kwh/i.test(lower)
      ) {
        warnings.push({
          code: ValidationWarningCode.UNEXPECTED_UNIT,
          severity: WarningSeverity.MEDIUM,
          message: 'Units Consumed field appears to use a non-kWh unit.',
          field: 'Units Consumed (kWh)',
        });
      }
    }
  }

  return warnings;
}

function normalizeUnit(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/³/g, '3');
}
