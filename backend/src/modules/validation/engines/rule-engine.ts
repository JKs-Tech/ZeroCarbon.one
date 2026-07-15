import type { ConfigService } from '../../config';
import type { ValidationWarning } from '../interfaces/validation-result.interface';
import { validateAccountNumber } from '../rules/account-number.rule';
import { validateAmounts } from '../rules/amount.rule';
import { validateConsistency } from '../rules/consistency.rule';
import { validateDates } from '../rules/date.rule';
import { validateRequiredFields } from '../rules/required-fields.rule';
import { validateUnits } from '../rules/units.rule';
import { mergeWarnings } from '../validation.helpers';

export interface RuleEngineInput {
  documentType: string;
  fields: Record<string, string | number | null>;
}

/**
 * Ordered deterministic rule engine. No AI. No I/O.
 */
export class RuleEngine {
  public constructor(private readonly config: ConfigService) {}

  public evaluate(input: RuleEngineInput): ValidationWarning[] {
    const { documentType, fields } = input;
    const limits = {
      maxAllowedAmount: this.config.validation.maxAllowedAmount,
      maxAllowedConsumption: this.config.validation.maxAllowedConsumption,
      maxAllowedQuantity: this.config.validation.maxAllowedQuantity,
    };

    return mergeWarnings(
      validateRequiredFields(documentType, fields),
      validateAmounts(fields, limits),
      validateDates(fields),
      validateUnits(documentType, fields),
      validateAccountNumber(documentType, fields),
      validateConsistency(fields),
    );
  }
}
