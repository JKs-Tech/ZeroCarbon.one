import type { LoggerService } from '../../logger';
import type { VendorResult } from '../interfaces/vendor-result.interface';
import type { AiProvider } from '../providers/ai-provider.interface';

/**
 * Vendor Agent — independent task; unaware of other agents.
 */
export class VendorDetectionTask {
  public constructor(
    private readonly provider: AiProvider,
    private readonly logger: LoggerService,
  ) {}

  public async run(ocrText: string, context: { documentId: string; workerId: number }): Promise<VendorResult> {
    this.logger.info('Vendor Detection Started', {
      documentId: context.documentId,
      workerId: context.workerId,
      model: this.provider.model,
      provider: this.provider.name,
    });

    const startedAt = Date.now();
    const result = await this.provider.identifyVendor(ocrText);

    this.logger.info('Vendor Detection Completed', {
      documentId: context.documentId,
      workerId: context.workerId,
      vendor: result.vendor,
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
