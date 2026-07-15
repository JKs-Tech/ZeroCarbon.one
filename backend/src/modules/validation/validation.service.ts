import type { ConfigService } from '../config';
import type { LoggerService } from '../logger';
import type { DocumentsRepository } from '../documents';
import { RuleEngine } from './engines/rule-engine';
import type {
  ValidationInput,
  ValidationResult,
  ValidationWarning,
} from './interfaces/validation-result.interface';
import { buildDuplicateWarnings } from './rules/duplicate.rule';
import { getField, isMissing, mergeWarnings } from './validation.helpers';

/**
 * Deterministic validation over AI extraction output.
 * Never mutates extracted fields. Never calls AI.
 */
export class ValidationService {
  private readonly ruleEngine: RuleEngine;

  public constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly documentsRepository: DocumentsRepository,
  ) {
    this.ruleEngine = new RuleEngine(config);
  }

  /**
   * Validates structured extraction and optionally checks for duplicates.
   */
  public async validate(
    input: ValidationInput,
    context: { workerId?: number } = {},
  ): Promise<ValidationResult> {
    const startedAt = Date.now();
    const workerId = context.workerId ?? process.pid;

    this.logger.info('Validation Started', {
      documentId: input.documentId,
      workerId,
      documentType: input.documentType,
      vendor: input.vendor,
    });

    let warnings: ValidationWarning[] = [];

    try {
      warnings = this.ruleEngine.evaluate({
        documentType: input.documentType,
        fields: input.fields,
      });

      if (this.config.validation.enableDuplicateCheck) {
        this.logger.info('Duplicate Check', {
          documentId: input.documentId,
          workerId,
        });

        const duplicateIds = await this.findDuplicates(input);
        warnings = mergeWarnings(warnings, buildDuplicateWarnings(duplicateIds));
      }
    } catch (error) {
      this.logger.error('Unexpected validation exception', {
        documentId: input.documentId,
        workerId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      throw error;
    }

    const processingTimeMs = Date.now() - startedAt;
    const warningCount = warnings.length;
    // Warnings only — never reject. isValid reflects a successful validation pass.
    const isValid = true;
    const summary =
      warningCount === 0
        ? 'No validation warnings.'
        : `${warningCount} validation warning(s) found.`;

    const result: ValidationResult = {
      isValid,
      warningCount,
      warnings,
      summary,
      processingTimeMs,
    };

    this.logger.info('Validation Completed', {
      documentId: input.documentId,
      workerId,
      warningCount,
      isValid,
      processingTimeMs,
      summary,
    });

    return result;
  }

  private async findDuplicates(input: ValidationInput): Promise<string[]> {
    try {
      const supplier =
        (!isMissing(input.vendor) && input.vendor !== 'Unknown'
          ? input.vendor
          : undefined) ??
        stringField(getField(input.fields, 'Supplier Name')) ??
        stringField(getField(input.fields, 'Utility Provider'));

      const invoiceNumber = stringField(getField(input.fields, 'Invoice Number'));
      const consumerNumber = stringField(getField(input.fields, 'Consumer Number'));
      const billingPeriod = stringField(getField(input.fields, 'Billing Period'));

      return await this.documentsRepository.findPotentialDuplicates(input.documentId, {
        supplier,
        invoiceNumber,
        consumerNumber,
        billingPeriod,
      });
    } catch (error) {
      this.logger.warn('Duplicate lookup failed — continuing without duplicate warning', {
        documentId: input.documentId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return [];
    }
  }
}

function stringField(value: string | number | null | undefined): string | undefined {
  if (isMissing(value)) {
    return undefined;
  }
  return String(value).trim();
}
