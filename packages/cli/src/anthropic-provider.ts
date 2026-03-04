/**
 * AnthropicProvider — Implements LLMProvider for the Anthropic API.
 *
 * Uses @anthropic-ai/sdk for streaming messages with tool use support.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  MessageParams,
  StreamEvent,
  Message,
  SystemBlock,
  ProviderFeatures,
  ModelInfo,
  ContentBlock,
} from '@mimi/core';

export interface AnthropicProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly supportedFeatures: ProviderFeatures = {
    streaming: true,
    toolUse: true,
    extendedThinking: true,
    imageInput: true,
    pdfInput: true,
    promptCaching: true,
  };

  private client: Anthropic;
  private defaultModel: string;

  constructor(config: AnthropicProviderConfig = {}) {
    this.client = new Anthropic({
      apiKey: config.apiKey ?? process.env['ANTHROPIC_API_KEY'],
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
    this.defaultModel = config.defaultModel ?? 'claude-sonnet-4-6';
  }

  /**
   * Create a streaming message response.
   */
  async *createMessage(params: MessageParams): AsyncIterable<StreamEvent> {
    const model = params.model || this.defaultModel;

    // Convert our message format to Anthropic's format
    const messages = params.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: this.convertContentBlocks(msg.content),
    }));

    // Convert system blocks
    const system = params.system?.map((block) => ({
      type: 'text' as const,
      text: block.text,
      ...(block.cacheControl ? { cache_control: { type: 'ephemeral' as const } } : {}),
    }));

    // Convert tool schemas
    const tools = params.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
      ...(tool.cacheControl ? { cache_control: { type: 'ephemeral' as const } } : {}),
    }));

    // Create the streaming request
    const stream = this.client.messages.stream({
      model,
      messages,
      system,
      tools: tools && tools.length > 0 ? tools : undefined,
      max_tokens: params.maxTokens,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params.thinking ? {
        thinking: {
          type: 'enabled' as const,
          budget_tokens: params.thinking.budgetTokens,
        },
      } : {}),
    });

    // Emit message_start
    yield {
      type: 'message_start',
      messageId: `msg_${Date.now()}`,
    };

    // Track content blocks for proper indexing
    let currentIndex = -1;

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start': {
          currentIndex = event.index;
          const block = event.content_block;

          if (block.type === 'text') {
            yield {
              type: 'content_block_start',
              index: currentIndex,
              contentBlock: { type: 'text', text: '' },
            };
          } else if (block.type === 'tool_use') {
            yield {
              type: 'content_block_start',
              index: currentIndex,
              contentBlock: {
                type: 'tool_use',
                id: block.id,
                name: block.name,
                input: {},
              },
            };
          } else if (block.type === 'thinking') {
            yield {
              type: 'content_block_start',
              index: currentIndex,
              contentBlock: { type: 'thinking', thinking: '' },
            };
          }
          break;
        }

        case 'content_block_delta': {
          const delta = event.delta;
          if (delta.type === 'text_delta') {
            yield {
              type: 'content_block_delta',
              index: event.index,
              delta: { type: 'text_delta', text: delta.text },
            };
          } else if (delta.type === 'input_json_delta') {
            yield {
              type: 'content_block_delta',
              index: event.index,
              delta: { type: 'input_json_delta', partialJson: delta.partial_json },
            };
          } else if (delta.type === 'thinking_delta') {
            yield {
              type: 'content_block_delta',
              index: event.index,
              delta: { type: 'thinking_delta', thinking: delta.thinking },
            };
          }
          break;
        }

        case 'content_block_stop': {
          yield {
            type: 'content_block_stop',
            index: event.index,
          };
          break;
        }

        case 'message_delta': {
          const usage = event.usage;
          yield {
            type: 'message_delta',
            stopReason: (event.delta.stop_reason ?? 'end_turn') as 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence',
            usage: usage ? {
              inputTokens: 0,
              outputTokens: usage.output_tokens,
            } : undefined,
          };
          break;
        }

        case 'message_stop': {
          yield { type: 'message_stop' };
          break;
        }
      }
    }

    // Get final message for complete usage
    const finalMessage = await stream.finalMessage();
    if (finalMessage.usage) {
      yield {
        type: 'message_delta',
        stopReason: finalMessage.stop_reason as 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence',
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
          cacheCreationInputTokens: (finalMessage.usage as unknown as Record<string, number>)['cache_creation_input_tokens'],
          cacheReadInputTokens: (finalMessage.usage as unknown as Record<string, number>)['cache_read_input_tokens'],
        },
      };
    }
  }

  /**
   * Count tokens for messages.
   */
  async countTokens(messages: Message[], system?: SystemBlock[]): Promise<number> {
    try {
      const result = await this.client.messages.countTokens({
        model: this.defaultModel,
        messages: messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: this.convertContentBlocks(msg.content),
        })),
        system: system?.map((block) => ({
          type: 'text' as const,
          text: block.text,
        })),
      });
      return result.input_tokens;
    } catch {
      // Fallback: rough estimate
      const text = messages.map((m) =>
        m.content.map((c) => ('text' in c ? c.text : '')).join('')
      ).join('');
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * List available models.
   */
  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'claude-opus-4-6',
        name: 'Claude Opus 4.6',
        maxInputTokens: 200_000,
        maxOutputTokens: 32_000,
        supportsTools: true,
        supportsThinking: true,
        inputPricePerMToken: 15,
        outputPricePerMToken: 75,
        cachedInputPricePerMToken: 1.875,
      },
      {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        maxInputTokens: 200_000,
        maxOutputTokens: 16_000,
        supportsTools: true,
        supportsThinking: true,
        inputPricePerMToken: 3,
        outputPricePerMToken: 15,
        cachedInputPricePerMToken: 0.375,
      },
      {
        id: 'claude-haiku-4-5-20251001',
        name: 'Claude Haiku 4.5',
        maxInputTokens: 200_000,
        maxOutputTokens: 8_192,
        supportsTools: true,
        supportsThinking: false,
        inputPricePerMToken: 0.8,
        outputPricePerMToken: 4,
        cachedInputPricePerMToken: 0.1,
      },
    ];
  }

  // ── Private ─────────────────────────────────────────────────────────

  private convertContentBlocks(blocks: ContentBlock[]): Anthropic.MessageParam['content'] {
    return blocks.map((block) => {
      switch (block.type) {
        case 'text':
          return { type: 'text' as const, text: block.text };
        case 'image':
          if (block.source.type === 'base64') {
            return {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: block.source.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: block.source.data,
              },
            };
          }
          // URL images need to be fetched — return as text for now
          return { type: 'text' as const, text: `[Image: ${block.source.url}]` };
        case 'tool_use':
          return {
            type: 'tool_use' as const,
            id: block.id,
            name: block.name,
            input: block.input,
          };
        case 'tool_result':
          return {
            type: 'tool_result' as const,
            tool_use_id: block.toolUseId,
            content: block.content.map((c) => {
              if (c.type === 'text') {
                return { type: 'text' as const, text: c.text };
              }
              return {
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: c.source.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: c.source.data,
                },
              };
            }),
            is_error: block.isError,
          };
        case 'thinking':
          return { type: 'thinking' as const, thinking: block.thinking };
        default:
          return { type: 'text' as const, text: '' };
      }
    }) as Anthropic.MessageParam['content'];
  }
}
