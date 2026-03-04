import type { EventBus } from './event-bus.js';
import type { LLMProvider } from './provider.js';
import type { PromptAssembler, SystemReminder } from './prompt-assembler.js';
import type { SessionStore } from './session-store.js';
import type { ResourceManager } from './resource-manager.js';
import type {
  AgentState,
  ContentBlock,
  Message,
  ToolResult,
  ToolUseBlock,
  UsageInfo,
} from './types.js';

// Tool executor interface (implemented by @mimi/tools package)
export interface ToolExecutor {
  execute(toolName: string, input: unknown, abortSignal: AbortSignal): Promise<ToolResult>;
  hasPermission(toolName: string, input: unknown): Promise<{ decision: 'allow' | 'deny' | 'ask' }>;
}

// Permission prompt callback (implemented by UI)
export interface PermissionPrompt {
  ask(toolName: string, input: unknown): Promise<{ allowed: boolean; persist: boolean }>;
}

export interface AgentLoopConfig {
  provider: LLMProvider;
  assembler: PromptAssembler;
  sessionStore: SessionStore;
  eventBus: EventBus;
  resourceManager: ResourceManager;
  toolExecutor: ToolExecutor;
  permissionPrompt: PermissionPrompt;
  sessionId: string;
  maxTurns?: number; // default 100, safety limit
  compactionThreshold?: number; // 0-1, default 0.6
}

export class AgentLoop {
  private state: AgentState = 'IDLE';
  private messages: Message[] = [];
  private turnCount = 0;
  private abortController: AbortController | null = null;
  private config: AgentLoopConfig;

  constructor(config: AgentLoopConfig) {
    this.config = config;
  }

  get currentState(): AgentState {
    return this.state;
  }

  get currentTurnCount(): number {
    return this.turnCount;
  }

  get allMessages(): ReadonlyArray<Message> {
    return this.messages;
  }

  /**
   * Run the agent loop for a single user message.
   * Returns when the agent produces a final response (no more tool calls).
   */
  async run(userMessage: string, reminders: SystemReminder[] = []): Promise<Message[]> {
    if (this.state !== 'IDLE') {
      throw new Error(`Cannot start run: agent is in state ${this.state}`);
    }

    // Add user message
    this.messages.push({
      role: 'user',
      content: [{ type: 'text', text: userMessage }],
      metadata: { timestamp: Date.now() },
    });

    const maxTurns = this.config.maxTurns ?? 100;
    const newMessages: Message[] = [];

    try {
      while (this.turnCount < maxTurns) {
        this.turnCount++;
        this.setState('ASSEMBLING');
        this.config.eventBus.emit('agent:turn_start', { turnIndex: this.turnCount });

        // Check if compaction needed
        const tokenCount = await this.config.provider.countTokens(this.messages);
        const threshold = this.config.compactionThreshold ?? 0.6;
        // Use a rough 200K context window estimate
        if (tokenCount / 200_000 > threshold) {
          this.setState('COMPACTING');
          await this.compact();
        }

        // Build request
        const assembled = this.config.assembler.build(this.messages, reminders);

        // Stream response
        this.setState('STREAMING');
        this.abortController = new AbortController();

        const assistantContent: ContentBlock[] = [];
        const jsonBuffers = new Map<number, string>(); // index → partial JSON for tool_use
        let stopReason = 'end_turn';
        let usage: UsageInfo | undefined;

        for await (const event of this.config.provider.createMessage(assembled.params)) {
          if (this.abortController.signal.aborted) {
            this.setState('CANCELLED');
            return newMessages;
          }

          switch (event.type) {
            case 'message_start':
              this.config.eventBus.emit('stream:start', { messageId: event.messageId });
              break;
            case 'content_block_start':
              assistantContent.push(event.contentBlock);
              break;
            case 'content_block_delta': {
              const delta = event.delta;
              if (delta.type === 'text_delta') {
                this.config.eventBus.emit('stream:delta', {
                  index: event.index,
                  text: delta.text,
                });
                const block = assistantContent[event.index];
                if (block && block.type === 'text') {
                  block.text += delta.text;
                }
              } else if (delta.type === 'thinking_delta') {
                const block = assistantContent[event.index];
                if (block && block.type === 'thinking') {
                  block.thinking += delta.thinking;
                }
              } else if (delta.type === 'input_json_delta') {
                const existing = jsonBuffers.get(event.index) ?? '';
                jsonBuffers.set(event.index, existing + delta.partialJson);
              }
              break;
            }
            case 'content_block_stop': {
              // Parse accumulated tool input JSON
              const jsonStr = jsonBuffers.get(event.index);
              if (jsonStr) {
                const block = assistantContent[event.index];
                if (block && block.type === 'tool_use') {
                  try {
                    block.input = JSON.parse(jsonStr) as Record<string, unknown>;
                  } catch {
                    block.input = { _raw: jsonStr };
                  }
                }
                jsonBuffers.delete(event.index);
              }
              break;
            }
            case 'message_delta':
              stopReason = event.stopReason;
              usage = event.usage;
              break;
            case 'message_stop':
              this.config.eventBus.emit('stream:stop', { stopReason, usage });
              break;
          }
        }

        // Save assistant message
        const assistantMessage: Message = {
          role: 'assistant',
          content: assistantContent,
          metadata: { timestamp: Date.now(), turnIndex: this.turnCount },
        };
        this.messages.push(assistantMessage);
        newMessages.push(assistantMessage);
        this.config.sessionStore.saveMessage(this.config.sessionId, assistantMessage);

        this.config.eventBus.emit('agent:turn_end', {
          turnIndex: this.turnCount,
          tokenCount: usage?.inputTokens ?? 0,
        });

        // Report cache metrics
        if (usage?.cacheReadInputTokens !== undefined) {
          const total = (usage.cacheReadInputTokens ?? 0) + (usage.cacheCreationInputTokens ?? 0);
          const hitRate = total > 0 ? (usage.cacheReadInputTokens ?? 0) / total : 0;
          this.config.eventBus.emit('cache:metrics', {
            hitRate,
            readTokens: usage.cacheReadInputTokens ?? 0,
            creationTokens: usage.cacheCreationInputTokens ?? 0,
          });
        }

        // Check for tool use
        const toolUseBlocks = assistantContent.filter(
          (b): b is ToolUseBlock => b.type === 'tool_use',
        );

        if (toolUseBlocks.length === 0 || stopReason !== 'tool_use') {
          // No tool calls — we're done
          this.setState('IDLE');
          return newMessages;
        }

        // Execute tools
        const toolResults: ContentBlock[] = [];

        for (const toolUse of toolUseBlocks) {
          // Check permission
          this.setState('CHECKING_PERM');
          const perm = await this.config.toolExecutor.hasPermission(toolUse.name, toolUse.input);

          if (perm.decision === 'ask') {
            this.setState('AWAITING_USER');
            this.config.eventBus.emit('tool:permission', {
              toolName: toolUse.name,
              decision: 'ask',
            });

            const response = await this.config.permissionPrompt.ask(toolUse.name, toolUse.input);

            if (!response.allowed) {
              toolResults.push({
                type: 'tool_result',
                toolUseId: toolUse.id,
                content: [{ type: 'text', text: 'Permission denied by user.' }],
                isError: true,
              });
              continue;
            }
          } else if (perm.decision === 'deny') {
            toolResults.push({
              type: 'tool_result',
              toolUseId: toolUse.id,
              content: [{ type: 'text', text: 'Permission denied by rule.' }],
              isError: true,
            });
            continue;
          }

          // Execute
          this.setState('EXECUTING_TOOL');
          const startTime = Date.now();
          this.config.eventBus.emit('tool:start', {
            toolName: toolUse.name,
            toolUseId: toolUse.id,
            input: toolUse.input,
          });

          let result: ToolResult;
          try {
            result = await this.config.toolExecutor.execute(
              toolUse.name,
              toolUse.input,
              this.abortController.signal,
            );
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            result = {
              content: [{ type: 'text', text: `Tool error: ${errMsg}` }],
              isError: true,
            };
            this.config.eventBus.emit('tool:error', {
              toolName: toolUse.name,
              error: error instanceof Error ? error : new Error(errMsg),
            });
          }

          const durationMs = Date.now() - startTime;
          this.config.eventBus.emit('tool:end', {
            toolName: toolUse.name,
            toolUseId: toolUse.id,
            result,
            durationMs,
          });

          // Save tool result
          this.config.sessionStore.saveToolResult(
            this.config.sessionId,
            null,
            toolUse.name,
            toolUse.id,
            toolUse.input,
            result.content,
            result.isError ?? false,
            durationMs,
          );

          toolResults.push({
            type: 'tool_result',
            toolUseId: toolUse.id,
            content: result.content,
            isError: result.isError,
          });
        }

        // Add tool results as user message and loop back
        const toolResultMessage: Message = {
          role: 'user',
          content: toolResults,
          metadata: { timestamp: Date.now() },
        };
        this.messages.push(toolResultMessage);
        newMessages.push(toolResultMessage);
        this.config.sessionStore.saveMessage(this.config.sessionId, toolResultMessage);

        this.setState('LOOP_BACK');
        // Clear reminders after first turn (they're dynamic per-turn)
        reminders = [];
      }

      // Max turns reached
      this.setState('IDLE');
      return newMessages;
    } catch (error) {
      this.setState('IDLE');
      throw error;
    }
  }

  /**
   * Cancel the current run.
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.setState('CANCELLED');
  }

  /**
   * Load messages from a previous session for resumption.
   */
  loadMessages(messages: Message[]): void {
    this.messages = [...messages];
  }

  private setState(newState: AgentState): void {
    const from = this.state;
    this.state = newState;
    this.config.eventBus.emit('agent:state_change', { from, to: newState });
  }

  private async compact(): Promise<void> {
    const recentCount = 10;
    if (this.messages.length <= recentCount * 2) return;

    const splitIdx = this.messages.length - recentCount * 2;
    const oldMessages = this.messages.slice(0, splitIdx);
    const recentMessages = this.messages.slice(splitIdx);

    // Keep anchored messages
    const anchors = oldMessages.filter((m) => m.metadata?.anchor);
    const compactable = oldMessages.filter((m) => !m.metadata?.anchor);

    this.config.eventBus.emit('compaction:start', {
      messageCount: compactable.length,
      tokenCount: 0,
    });

    // Build compaction request (reuses same cache prefix)
    const compactionReq = this.config.assembler.buildCompactionRequest(compactable, recentMessages);

    // Get summary from LLM
    let summaryText = '';
    for await (const event of this.config.provider.createMessage(compactionReq.params)) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        summaryText += event.delta.text;
      }
    }

    // Reconstruct message array
    this.messages = [
      {
        role: 'user',
        content: [{ type: 'text', text: `Previous conversation summary:\n${summaryText}` }],
        metadata: { compactionSummary: true },
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Understood. I have the context from our previous conversation.' }],
      },
      ...anchors,
      ...recentMessages,
    ];

    this.config.eventBus.emit('compaction:end', {
      removedMessages: compactable.length,
      savedTokens: 0,
    });
  }
}
