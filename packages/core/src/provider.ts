import type {
  Message,
  MessageParams,
  ModelInfo,
  StreamEvent,
  SystemBlock,
  ProviderFeatures,
} from './types.js';

/**
 * LLMProvider — Abstract interface for AI model providers.
 * Implementations: AnthropicProvider, OpenAIProvider, OllamaProvider
 */
export interface LLMProvider {
  readonly name: string;
  readonly supportedFeatures: ProviderFeatures;

  /** Create a streaming message response */
  createMessage(params: MessageParams): AsyncIterable<StreamEvent>;

  /** Count tokens for the given messages (provider-specific for accuracy) */
  countTokens(messages: Message[], system?: SystemBlock[]): Promise<number>;

  /** List available models (optional) */
  listModels?(): Promise<ModelInfo[]>;
}

/**
 * StreamNormalizer — Converts provider-specific stream events into
 * unified StreamEvent types. Each provider implementation wraps its
 * native stream in a normalizer.
 */
export abstract class StreamNormalizer {
  abstract normalize(rawStream: AsyncIterable<unknown>): AsyncIterable<StreamEvent>;
}
