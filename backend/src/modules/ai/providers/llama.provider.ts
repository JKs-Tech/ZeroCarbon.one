import { StubAiProvider } from './stub-ai.provider';

/** Future Llama adapter — swap via AI_PROVIDER=llama. */
export class LlamaProvider extends StubAiProvider {
  public readonly name = 'llama';
  public readonly model = 'unset';
}
