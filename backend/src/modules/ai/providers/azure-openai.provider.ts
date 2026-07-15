import { StubAiProvider } from './stub-ai.provider';

/** Future Azure OpenAI adapter — swap via AI_PROVIDER=azure-openai. */
export class AzureOpenAiProvider extends StubAiProvider {
  public readonly name = 'azure-openai';
  public readonly model = 'unset';
}
