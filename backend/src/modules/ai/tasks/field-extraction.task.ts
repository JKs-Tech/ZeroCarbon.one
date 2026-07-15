import type { LoggerService } from '../../logger';
import type { DocumentCategoryValue } from '../ai.constants';
import type { ExtractionResult } from '../interfaces/extraction-result.interface';
import type { AiProvider } from '../providers/ai-provider.interface';

/**
 * Extraction Agent — independent task; unaware of other agents.
 * Receives document type + vendor from the orchestrator, not from peer agents.
 */
export class FieldExtractionTask {
  public constructor(
    private readonly provider: AiProvider,
    private readonly logger: LoggerService,
  ) {}

  public async run(
    ocrText: string,
    documentType: DocumentCategoryValue,
    vendor: string,
    context: { documentId: string; workerId: number },
  ): Promise<ExtractionResult> {
    this.logger.info('Extraction Started', {
      documentId: context.documentId,
      workerId: context.workerId,
      documentType,
      vendor,
      model: this.provider.model,
      provider: this.provider.name,
    });

    const startedAt = Date.now();
    const result = await this.provider.extractFields(ocrText, documentType, vendor);

    this.logger.info('Extraction Completed', {
      documentId: context.documentId,
      workerId: context.workerId,
      documentType: result.documentType,
      vendor: result.vendor,
      fieldCount: Object.keys(result.fields).length,
      model: result.model,
      provider: result.provider,
      durationMs: result.durationMs,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      wallMs: Date.now() - startedAt,
    });

    return result;
  }
}
