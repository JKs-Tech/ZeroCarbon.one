import { StubAiProvider } from './stub-ai.provider';

/** Future Claude adapter — swap via AI_PROVIDER=claude. */
export class ClaudeProvider extends StubAiProvider {
  public readonly name = 'claude';
  public readonly model = 'unset';
}
