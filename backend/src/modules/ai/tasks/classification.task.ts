import type { LoggerService } from '../../logger';
import type { ClassificationResult } from '../interfaces/classification-result.interface';
import type { AiProvider } from '../providers/ai-provider.interface';

/**
 * Classification Agent — independent task; unaware of other agents.
 */
export class ClassificationTask {
  public constructor(
    private readonly provider: AiProvider,
    private readonly logger: LoggerService,
  ) {}

  public async run(ocrText: string, context: { documentId: string; workerId: number }): Promise<ClassificationResult> {
    this.logger.info('Classification Started', {
      documentId: context.documentId,
      workerId: context.workerId,
      model: this.provider.model,
      provider: this.provider.name,
    });

    const startedAt = Date.now();
    const result = await this.provider.classifyDocument(ocrText);

    this.logger.info('Classification Completed', {
      documentId: context.documentId,
      workerId: context.workerId,
      documentType: result.documentType,
      confidence: result.confidence,
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
