import { StubAiProvider } from './stub-ai.provider';

/** Future Gemini adapter — swap via AI_PROVIDER=gemini. */
export class GeminiProvider extends StubAiProvider {
  public readonly name = 'gemini';
  public readonly model = 'unset';
}
