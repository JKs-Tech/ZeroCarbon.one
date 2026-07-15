import type { ConfigService } from '../../config';
import type { LoggerService } from '../../logger';
import { AiProviderId } from '../ai.constants';
import type { AiProvider } from './ai-provider.interface';
import { AzureOpenAiProvider } from './azure-openai.provider';
import { ClaudeProvider } from './claude.provider';
import { GeminiProvider } from './gemini.provider';
import { LlamaProvider } from './llama.provider';
import { MistralProvider } from './mistral.provider';
import { OllamaProvider } from './ollama.provider';
import { OpenAiProvider } from './openai.provider';

/**
 * Resolves the configured AI provider implementation.
 * Swap providers via AI_PROVIDER without changing business modules.
 */
export class AiProviderFactory {
  public static create(config: ConfigService, logger: LoggerService): AiProvider {
    const providerId = config.ai.provider;
    const providerLogger = logger.child(`AiProvider:${providerId}`);

    switch (providerId) {
      case AiProviderId.OPENAI:
        return new OpenAiProvider(config, providerLogger);
      case AiProviderId.OLLAMA:
        return new OllamaProvider();
      case AiProviderId.CLAUDE:
        return new ClaudeProvider();
      case AiProviderId.GEMINI:
        return new GeminiProvider();
      case AiProviderId.MISTRAL:
        return new MistralProvider();
      case AiProviderId.LLAMA:
        return new LlamaProvider();
      case AiProviderId.AZURE_OPENAI:
        return new AzureOpenAiProvider();
      default: {
        const exhaustive: never = providerId;
        throw new Error(`Unsupported AI_PROVIDER: ${String(exhaustive)}`);
      }
    }
  }
}
