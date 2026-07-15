import { StubAiProvider } from './stub-ai.provider';

/** Future Mistral adapter — swap via AI_PROVIDER=mistral. */
export class MistralProvider extends StubAiProvider {
  public readonly name = 'mistral';
  public readonly model = 'unset';
}
