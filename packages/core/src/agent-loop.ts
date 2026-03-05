import type { EventBus } from './event-bus.js';
import type { LLMProvider } from './provider.js';
import type { PromptAssembler, SystemReminder } from './prompt-assembler.js';
import type { SessionStore } from './session-store.js';
import type { ResourceManager } from './resource-manager.js';
import type {
  AgentState,
  ContentBlock,
  HookEvent,
  HookResult,
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

// Hook runner interface (implemented by @mimi/hooks package)
export interface HookRunnerLike {
  fire(event: HookEvent, context: {
    event: HookEvent;
    sessionId: string;
    workingDirectory: string;
    toolName?: string;
    toolInput?: string;
    toolOutput?: string;
  }): Promise<HookResult>;
}

export interface AgentLoopConfig {
  provider: LLMProvider;
  assembler: PromptAssembler;
  sessionStore: SessionStore;
  eventBus: EventBus;
  resourceManager: ResourceManager;
  toolExecutor: ToolExecutor;
  permissionPrompt: PermissionPrompt;
  hookRunner?: HookRunnerLike;
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

          // Fire PreToolUse hook
          let toolInput = toolUse.input;
          if (this.config.hookRunner) {
            const hookResult = await this.config.hookRunner.fire('PreToolUse', {
              event: 'PreToolUse',
              sessionId: this.config.sessionId,
              workingDirectory: process.cwd(),
              toolName: toolUse.name,
              toolInput: JSON.stringify(toolInput),
            });
            if (hookResult.action === 'block') {
              toolResults.push({
                type: 'tool_result',
                toolUseId: toolUse.id,
                content: [{ type: 'text', text: hookResult.message ?? 'Blocked by hook.' }],
                isError: true,
              });
              continue;
            }
            if (hookResult.action === 'modify' && hookResult.modifiedInput) {
              toolInput = hookResult.modifiedInput as Record<string, unknown>;
            }
          }

          // Execute
          this.setState('EXECUTING_TOOL');
          const startTime = Date.now();
          this.config.eventBus.emit('tool:start', {
            toolName: toolUse.name,
            toolUseId: toolUse.id,
            input: toolInput,
          });

          let result: ToolResult;
          try {
            result = await this.config.toolExecutor.execute(
              toolUse.name,
              toolInput,
              this.abortController.signal,
            );

            // Fire PostToolUse hook
            if (this.config.hookRunner) {
              await this.config.hookRunner.fire('PostToolUse', {
                event: 'PostToolUse',
                sessionId: this.config.sessionId,
                workingDirectory: process.cwd(),
                toolName: toolUse.name,
                toolInput: JSON.stringify(toolInput),
                toolOutput: JSON.stringify(result.content).slice(0, 4096),
              });
            }
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

            // Fire PostToolUseFailure hook
            if (this.config.hookRunner) {
              await this.config.hookRunner.fire('PostToolUseFailure', {
                event: 'PostToolUseFailure',
                sessionId: this.config.sessionId,
                workingDirectory: process.cwd(),
                toolName: toolUse.name,
                toolInput: JSON.stringify(toolInput),
                toolOutput: errMsg,
              });
            }
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
      const err = error instanceof Error ? error : new Error(String(error));
      this.config.eventBus.emit('agent:error', { error: err });
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

  /**
   * Compact conversation history to fit within context budget.
   *
   * Strategy:
   *   1. Anchored messages (project config, pinned context) are NEVER compacted
   *   2. Dynamic split: keep enough recent turns to fill ~30% of context
   *   3. Summarize old messages via LLM (reuses cache prefix)
   *   4. Track actual token savings
   */
  private async compact(): Promise<void> {
    // Dynamic split: keep recent messages up to 30% of context budget
    const contextBudget = 200_000;
    const recentBudget = contextBudget * 0.3;

    // Count tokens from the end to find the split point
    let recentTokens = 0;
    let splitIdx = this.messages.length;

    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i]!;
      // Rough estimate: 4 chars per token across all content blocks
      const msgTokens = msg.content.reduce((sum, block) => {
        if (block.type === 'text') return sum + Math.ceil(block.text.length / 4);
        if (block.type === 'tool_use') return sum + Math.ceil(JSON.stringify(block.input).length / 4);
        if (block.type === 'tool_result') {
          return sum + block.content.reduce((s, c) => s + ('text' in c ? Math.ceil(c.text.length / 4) : 100), 0);
        }
        return sum + 50; // thinking blocks etc.
      }, 0);

      if (recentTokens + msgTokens > recentBudget) {
        splitIdx = i + 1;
        break;
      }
      recentTokens += msgTokens;
    }

    // Need at least 4 messages in "old" to justify compaction
    if (splitIdx < 4) return;

    const oldMessages = this.messages.slice(0, splitIdx);
    const recentMessages = this.messages.slice(splitIdx);

    // Separate protected anchors from compactable messages
    const anchors = oldMessages.filter((m) => m.metadata?.anchor);
    const compactable = oldMessages.filter((m) => !m.metadata?.anchor && !m.metadata?.compactionSummary);

    if (compactable.length < 2) return;

    // Estimate tokens before compaction
    const preCompactionTokens = compactable.reduce((sum, msg) => {
      return sum + msg.content.reduce((s, block) => {
        if (block.type === 'text') return s + Math.ceil(block.text.length / 4);
        return s + 50;
      }, 0);
    }, 0);

    this.config.eventBus.emit('compaction:start', {
      messageCount: compactable.length,
      tokenCount: preCompactionTokens,
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

    // Estimate tokens after compaction
    const postCompactionTokens = Math.ceil(summaryText.length / 4) + 50; // +50 for wrapper

    // Reconstruct message array: summary → anchors → recent
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

    const savedTokens = Math.max(0, preCompactionTokens - postCompactionTokens);

    this.config.eventBus.emit('compaction:end', {
      removedMessages: compactable.length,
      savedTokens,
      retainedAnchors: anchors.length,
      newMessageCount: this.messages.length,
    });
  }
}
