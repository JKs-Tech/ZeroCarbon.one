import OpenAI from 'openai';
import type { ConfigService } from '../../config';
import type { LoggerService } from '../../logger';
import { AiOutputTokenBudget, type DocumentCategoryValue } from '../ai.constants';
import { AiPermanentError, AiTransientError } from '../ai.errors';
import {
  normalizeConfidence,
  normalizeDocumentType,
  normalizeFields,
  parseModelJson,
} from '../ai.json';
import type { ClassificationResult } from '../interfaces/classification-result.interface';
import type { ExtractionResult } from '../interfaces/extraction-result.interface';
import type { VendorResult } from '../interfaces/vendor-result.interface';
import {
  buildClassificationSystemPrompt,
  buildClassificationUserPrompt,
} from '../prompts/classification.prompt';
import {
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
} from '../prompts/extraction.prompt';
import { buildVendorSystemPrompt, buildVendorUserPrompt } from '../prompts/vendor.prompt';
import { packOcrForAgent } from '../utils/ocr-pack';
import type { AiChatRequest, AiChatResponse, AiExtractionImage, AiProvider } from './ai-provider.interface';

/**
 * Official OpenAI GPT-5 Nano adapter (Responses API).
 *
 * Cost strategy:
 * - `reasoning.effort: minimal` (configurable)
 * - Per-step `max_output_tokens` (small for classify/vendor)
 * - Packed OCR (compressed + budgeted head/tail) to cut input tokens
 * - `store: false` — no server-side retention cost/leak risk
 *
 * @see https://platform.openai.com/docs/guides/reasoning
 * @see https://platform.openai.com/docs/guides/prompt-engineering
 */
export class OpenAiProvider implements AiProvider {
  public readonly name = 'openai';
  public readonly model: string;

  private readonly client: OpenAI;
  private readonly maxOutputTokens: number;
  private readonly reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';

  public constructor(
    config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    const { openai, maxOutputTokens, reasoningEffort } = config.ai;
    this.model = openai.model;
    this.maxOutputTokens = maxOutputTokens;
    this.reasoningEffort = reasoningEffort;

    this.client = new OpenAI({
      apiKey: openai.apiKey,
      baseURL: openai.baseUrl,
      timeout: openai.timeoutMs,
      maxRetries: 0,
    });
  }

  public async classifyDocument(ocrText: string): Promise<ClassificationResult> {
    const packed = packOcrForAgent(ocrText, 'classify');
    const response = await this.complete({
      systemPrompt: buildClassificationSystemPrompt(),
      userPrompt: buildClassificationUserPrompt(packed),
      maxOutputTokens: AiOutputTokenBudget.classify,
    });

    const parsed = parseModelJson(response.content);

    return {
      documentType: normalizeDocumentType(parsed.document_type ?? parsed.documentType),
      confidence: normalizeConfidence(parsed.confidence),
      reasoningSummary:
        typeof parsed.reason === 'string'
          ? parsed.reason
          : typeof parsed.reasoning_summary === 'string'
            ? parsed.reasoning_summary
            : typeof parsed.reasoningSummary === 'string'
              ? parsed.reasoningSummary
              : '',
      provider: response.provider,
      model: response.model,
      durationMs: response.durationMs,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      rawResponse: response.content,
    };
  }

  public async identifyVendor(ocrText: string): Promise<VendorResult> {
    const packed = packOcrForAgent(ocrText, 'vendor');
    const response = await this.complete({
      systemPrompt: buildVendorSystemPrompt(),
      userPrompt: buildVendorUserPrompt(packed),
      maxOutputTokens: AiOutputTokenBudget.vendor,
    });

    const parsed = parseModelJson(response.content);
    const vendorRaw = parsed.vendor;
    const vendor =
      typeof vendorRaw === 'string' && vendorRaw.trim().length > 0
        ? vendorRaw.trim()
        : 'Unknown';

    return {
      vendor,
      confidence: normalizeConfidence(parsed.confidence),
      provider: response.provider,
      model: response.model,
      durationMs: response.durationMs,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      rawResponse: response.content,
    };
  }

  public async extractFields(
    ocrText: string,
    documentType: DocumentCategoryValue,
    vendor: string,
    image?: AiExtractionImage,
  ): Promise<ExtractionResult> {
    const packed = packOcrForAgent(ocrText, 'extract');
    const useVision = Boolean(image?.buffer?.length);
    const response = await this.complete({
      systemPrompt: buildExtractionSystemPrompt(documentType),
      userPrompt: buildExtractionUserPrompt(packed, documentType, vendor, useVision),
      maxOutputTokens: Math.max(this.maxOutputTokens, AiOutputTokenBudget.extract),
      image: useVision ? image : undefined,
    });

    const parsed = parseModelJson(response.content);
    const fields = normalizeFields(parsed.fields ?? parsed);

    // Avoid leaking envelope keys into business fields when model flattens JSON.
    delete fields.document_type;
    delete fields.documentType;
    delete fields.vendor;
    delete fields.confidence_score;
    delete fields.confidenceScore;
    delete fields.confidence;

    return {
      documentType,
      vendor:
        typeof parsed.vendor === 'string' && parsed.vendor.trim().length > 0
          ? parsed.vendor.trim()
          : vendor,
      fields,
      confidenceScore: normalizeConfidence(
        parsed.confidence_score ?? parsed.confidenceScore ?? parsed.confidence,
      ),
      provider: response.provider,
      model: response.model,
      durationMs: response.durationMs,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      rawResponse: response.content,
    };
  }

  private async complete(
    request: AiChatRequest & { image?: AiExtractionImage },
  ): Promise<AiChatResponse> {
    const startedAt = Date.now();
    const maxOutputTokens = request.maxOutputTokens ?? this.maxOutputTokens;

    try {
      const input = request.image
        ? [
            {
              role: 'user' as const,
              content: [
                { type: 'input_text' as const, text: request.userPrompt },
                {
                  type: 'input_image' as const,
                  detail: 'high' as const,
                  image_url: `data:${request.image.mimeType};base64,${request.image.buffer.toString('base64')}`,
                },
              ],
            },
          ]
        : request.userPrompt;

      const response = await this.client.responses.create({
        model: this.model,
        instructions: request.systemPrompt,
        input,
        reasoning: {
          effort: this.reasoningEffort,
        },
        max_output_tokens: maxOutputTokens,
        text: {
          format: { type: 'json_object' },
        },
        store: false,
      });

      const content = extractResponseText(response);
      if (!content) {
        if (response.status === 'incomplete') {
          throw new AiTransientError(
            `OpenAI response incomplete (${response.incomplete_details?.reason ?? 'unknown'}) — raise output budget or shorten OCR`,
          );
        }
        throw new AiTransientError('OpenAI returned empty message content');
      }

      this.logger.debug('OpenAI step usage', {
        model: response.model || this.model,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        maxOutputTokens,
        vision: Boolean(request.image),
        durationMs: Date.now() - startedAt,
      });

      return {
        content,
        provider: this.name,
        model: response.model || this.model,
        promptTokens: response.usage?.input_tokens,
        completionTokens: response.usage?.output_tokens,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof AiPermanentError || error instanceof AiTransientError) {
      return error;
    }

    if (error instanceof OpenAI.APIError) {
      const status = error.status;
      const message = `OpenAI API error (${status ?? 'unknown'}): ${error.message}`;

      if (status === 429 || status === 408 || (status !== undefined && status >= 500)) {
        return new AiTransientError(message, error);
      }

      if (status === 400 || status === 401 || status === 403 || status === 404) {
        return new AiPermanentError(message);
      }

      return new AiTransientError(message, error);
    }

    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return new AiTransientError(`OpenAI timeout: ${error.message}`, error);
    }

    if (error instanceof OpenAI.APIConnectionError) {
      return new AiTransientError(`OpenAI connection error: ${error.message}`, error);
    }

    const message = error instanceof Error ? error.message : 'Unknown OpenAI failure';
    this.logger.warn('Unexpected OpenAI error mapping', { message });
    return new AiTransientError(message, error);
  }
}

function extractResponseText(response: OpenAI.Responses.Response): string {
  if (typeof response.output_text === 'string' && response.output_text.trim().length > 0) {
    return response.output_text;
  }

  const parts: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'message') {
      continue;
    }
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text);
      }
    }
  }

  return parts.join('\n').trim();
}
