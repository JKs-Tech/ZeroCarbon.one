import { DocumentCategory } from '../../ai';
import { ValidationWarningCode, WarningSeverity } from '../validation.constants';
import type { ValidationWarning } from '../interfaces/validation-result.interface';
import { getField, isMissing } from '../validation.helpers';

interface RequiredFieldSpec {
  field: string;
  code: (typeof ValidationWarningCode)[keyof typeof ValidationWarningCode];
  message: string;
}

/**
 * Missing required fields — mirrors assignment mandatory extraction field lists.
 */
export function validateRequiredFields(
  documentType: string,
  fields: Record<string, string | number | null>,
): ValidationWarning[] {
  const specs = requiredSpecsForType(documentType);
  const warnings: ValidationWarning[] = [];

  for (const spec of specs) {
    if (isMissing(getField(fields, spec.field))) {
      warnings.push({
        code: spec.code,
        severity: WarningSeverity.HIGH,
        message: spec.message,
        field: spec.field,
      });
    }
  }

  return warnings;
}

function requiredSpecsForType(documentType: string): RequiredFieldSpec[] {
  switch (documentType) {
    case DocumentCategory.ELECTRICITY_BILL:
      return [
        {
          field: 'Utility Provider',
          code: ValidationWarningCode.MISSING_UTILITY_PROVIDER,
          message: 'Utility provider is missing.',
        },
        {
          field: 'Consumer Number',
          code: ValidationWarningCode.MISSING_CONSUMER_NUMBER,
          message: 'Consumer number is missing.',
        },
        {
          field: 'Account Number',
          code: ValidationWarningCode.MISSING_ACCOUNT_NUMBER,
          message: 'Account number is missing.',
        },
        {
          field: 'Billing Period',
          code: ValidationWarningCode.MISSING_BILLING_PERIOD,
          message: 'Billing period is missing.',
        },
        {
          field: 'Bill Date',
          code: ValidationWarningCode.MISSING_BILL_DATE,
          message: 'Bill date is missing.',
        },
        {
          field: 'Due Date',
          code: ValidationWarningCode.MISSING_DUE_DATE,
          message: 'Due date is missing.',
        },
        {
          field: 'Units Consumed (kWh)',
          code: ValidationWarningCode.MISSING_UNITS_CONSUMED,
          message: 'Units consumed is missing.',
        },
        {
          field: 'Contract Demand',
          code: ValidationWarningCode.MISSING_CONTRACT_DEMAND,
          message: 'Contract demand is missing.',
        },
        {
          field: 'Maximum Demand',
          code: ValidationWarningCode.MISSING_MAXIMUM_DEMAND,
          message: 'Maximum demand is missing.',
        },
        {
          field: 'Total Bill Amount',
          code: ValidationWarningCode.MISSING_TOTAL_AMOUNT,
          message: 'Total bill amount is missing.',
        },
        {
          field: 'GST Amount',
          code: ValidationWarningCode.MISSING_GST_AMOUNT,
          message: 'GST amount is missing.',
        },
      ];
    case DocumentCategory.DIESEL_INVOICE:
      return [
        {
          field: 'Supplier Name',
          code: ValidationWarningCode.MISSING_SUPPLIER_NAME,
          message: 'Supplier name is missing.',
        },
        {
          field: 'Invoice Number',
          code: ValidationWarningCode.MISSING_INVOICE_NUMBER,
          message: 'Invoice number is missing.',
        },
        {
          field: 'Invoice Date',
          code: ValidationWarningCode.MISSING_INVOICE_DATE,
          message: 'Invoice date is missing.',
        },
        {
          field: 'Quantity (Litres)',
          code: ValidationWarningCode.MISSING_QUANTITY,
          message: 'Quantity is missing.',
        },
        {
          field: 'Rate Per Litre',
          code: ValidationWarningCode.MISSING_RATE_PER_LITRE,
          message: 'Rate per litre is missing.',
        },
        {
          field: 'Total Amount',
          code: ValidationWarningCode.MISSING_TOTAL_AMOUNT,
          message: 'Total amount is missing.',
        },
      ];
    case DocumentCategory.COAL_INVOICE:
      return [
        {
          field: 'Supplier Name',
          code: ValidationWarningCode.MISSING_SUPPLIER_NAME,
          message: 'Supplier name is missing.',
        },
        {
          field: 'Invoice Number',
          code: ValidationWarningCode.MISSING_INVOICE_NUMBER,
          message: 'Invoice number is missing.',
        },
        {
          field: 'Invoice Date',
          code: ValidationWarningCode.MISSING_INVOICE_DATE,
          message: 'Invoice date is missing.',
        },
        {
          field: 'Coal Grade',
          code: ValidationWarningCode.MISSING_COAL_GRADE,
          message: 'Coal grade is missing.',
        },
        {
          field: 'Quantity (Tonnes)',
          code: ValidationWarningCode.MISSING_QUANTITY,
          message: 'Quantity is missing.',
        },
        {
          field: 'GCV',
          code: ValidationWarningCode.MISSING_GCV,
          message: 'GCV is missing.',
        },
        {
          field: 'Moisture %',
          code: ValidationWarningCode.MISSING_MOISTURE,
          message: 'Moisture % is missing.',
        },
        {
          field: 'Total Amount',
          code: ValidationWarningCode.MISSING_TOTAL_AMOUNT,
          message: 'Total amount is missing.',
        },
      ];
    case DocumentCategory.WATER_BILL:
    case DocumentCategory.GAS_BILL:
    case DocumentCategory.LPG_BILL:
    case DocumentCategory.STEAM_BILL:
      return [
        {
          field: 'Supplier Name',
          code: ValidationWarningCode.MISSING_SUPPLIER_NAME,
          message: 'Supplier name is missing.',
        },
        {
          field: 'Billing Period',
          code: ValidationWarningCode.MISSING_BILLING_PERIOD,
          message: 'Billing period is missing.',
        },
        {
          field: 'Consumption Volume',
          code: ValidationWarningCode.MISSING_CONSUMPTION_VOLUME,
          message: 'Consumption volume is missing.',
        },
        {
          field: 'Unit',
          code: ValidationWarningCode.MISSING_UNIT,
          message: 'Unit is missing.',
        },
        {
          field: 'Total Amount',
          code: ValidationWarningCode.MISSING_TOTAL_AMOUNT,
          message: 'Total amount is missing.',
        },
      ];
    case DocumentCategory.RENEWABLE_ENERGY_CERTIFICATE:
      return [
        {
          field: 'Certificate Number',
          code: ValidationWarningCode.MISSING_INVOICE_NUMBER,
          message: 'Certificate number is missing.',
        },
        {
          field: 'Issuer',
          code: ValidationWarningCode.MISSING_SUPPLIER_NAME,
          message: 'Issuer is missing.',
        },
        {
          field: 'Quantity (MWh)',
          code: ValidationWarningCode.MISSING_QUANTITY,
          message: 'Quantity (MWh) is missing.',
        },
      ];
    case DocumentCategory.FUEL_TRANSPORT_INVOICE:
      return [
        {
          field: 'Supplier Name',
          code: ValidationWarningCode.MISSING_SUPPLIER_NAME,
          message: 'Supplier name is missing.',
        },
        {
          field: 'Invoice Number',
          code: ValidationWarningCode.MISSING_INVOICE_NUMBER,
          message: 'Invoice number is missing.',
        },
        {
          field: 'Invoice Date',
          code: ValidationWarningCode.MISSING_INVOICE_DATE,
          message: 'Invoice date is missing.',
        },
        {
          field: 'Total Amount',
          code: ValidationWarningCode.MISSING_TOTAL_AMOUNT,
          message: 'Total amount is missing.',
        },
      ];
    default:
      return [
        {
          field: 'Supplier Name',
          code: ValidationWarningCode.MISSING_SUPPLIER_NAME,
          message: 'Supplier name is missing.',
        },
        {
          field: 'Total Amount',
          code: ValidationWarningCode.MISSING_TOTAL_AMOUNT,
          message: 'Total amount is missing.',
        },
      ];
  }
}
