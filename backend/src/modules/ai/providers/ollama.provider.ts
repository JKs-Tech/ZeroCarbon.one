import { StubAiProvider } from './stub-ai.provider';

/** Future Ollama adapter — swap via AI_PROVIDER=ollama. */
export class OllamaProvider extends StubAiProvider {
  public readonly name = 'ollama';
  public readonly model = 'unset';
}
