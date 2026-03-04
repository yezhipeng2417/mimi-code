/**
 * PromptAssembler — Cache-optimized prompt construction.
 *
 * Builds API requests with strict static→dynamic ordering to maximize
 * prompt cache hit rates (see ARCHITECTURE.md Section 2.4).
 *
 * Layout:
 *   Layer 1: System prompt (core + brand)          [cache_control: ephemeral]
 *   Layer 2: Tool definitions (frozen at session)   [cache_control: ephemeral]
 *   Layer 3: Project config (MIMI.md/CLAUDE.md)     [cache_control: ephemeral]
 *   Layer 4: Conversation messages                  (prefix-cached)
 *   Layer 5: System reminders (dynamic, per-turn)   (uncached)
 */

import type {
  CacheHint,
  Message,
  MessageParams,
  SystemBlock,
  ToolSchema,
} from './types.js';

// ─── Configuration ─────────────────────────────────────────────────────────

export interface PromptAssemblerConfig {
  /** Core system prompt text (agent behavior, safety rules, tool instructions) */
  coreSystemPrompt: string;

  /** Brand prepend text (injected before core) */
  brandPrepend?: string;

  /** Brand append text (injected after core) */
  brandAppend?: string;

  /** Default model to use */
  defaultModel: string;

  /** Default max output tokens */
  defaultMaxTokens: number;

  /** Temperature (undefined = provider default) */
  temperature?: number;

  /** Enable extended thinking */
  thinking?: { type: 'enabled'; budgetTokens: number };
}

export interface ProjectConfig {
  /** Content from MIMI.md or CLAUDE.md */
  instructions: string;

  /** MCP server instructions (collected from connected servers) */
  mcpInstructions?: string;
}

export interface SystemReminder {
  /** Content to inject as a <system-reminder> in the latest user message */
  text: string;
}

// ─── Assembled Request ─────────────────────────────────────────────────────

export interface AssembledRequest {
  params: MessageParams;

  /** Metadata about the assembly for cache tracking */
  meta: {
    systemTokensEstimate: number;
    toolCount: number;
    messageCount: number;
    hasProjectConfig: boolean;
    reminderCount: number;
  };
}

// ─── Cache hint helper ─────────────────────────────────────────────────────

const EPHEMERAL: CacheHint = { type: 'ephemeral' };

// ─── PromptAssembler ───────────────────────────────────────────────────────

export class PromptAssembler {
  private config: PromptAssemblerConfig;
  private frozenTools: ToolSchema[] | null = null;
  private projectConfig: ProjectConfig | null = null;

  constructor(config: PromptAssemblerConfig) {
    this.config = config;
  }

  /**
   * Set the project-level configuration (MIMI.md/CLAUDE.md content).
   * Called once at session start.
   */
  setProjectConfig(config: ProjectConfig): void {
    this.projectConfig = config;
  }

  /**
   * Freeze tool definitions for the session.
   * MUST be called at session start. Tools cannot be added/removed after this.
   * Tools are sorted alphabetically for deterministic cache ordering.
   */
  freezeTools(tools: ToolSchema[]): void {
    if (this.frozenTools !== null) {
      throw new Error(
        'Tools already frozen for this session. Cannot modify tool definitions mid-session ' +
          '(this would break prompt cache). Use ToolSearch for deferred tool loading.',
      );
    }
    // Sort alphabetically for deterministic ordering
    this.frozenTools = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Build the API request with cache-optimized layout.
   *
   * @param messages  - Conversation messages (Layer 4)
   * @param reminders - Dynamic system reminders for this turn (Layer 5)
   * @param overrides - Per-turn overrides (model, maxTokens, etc.)
   */
  build(
    messages: Message[],
    reminders: SystemReminder[] = [],
    overrides?: Partial<Pick<MessageParams, 'model' | 'maxTokens' | 'temperature' | 'thinking'>>,
  ): AssembledRequest {
    // ── Layer 1: System prompt (static, globally cached) ──

    const systemPromptParts: string[] = [];

    if (this.config.brandPrepend) {
      systemPromptParts.push(this.config.brandPrepend);
    }

    systemPromptParts.push(this.config.coreSystemPrompt);

    if (this.config.brandAppend) {
      systemPromptParts.push(this.config.brandAppend);
    }

    const system: SystemBlock[] = [
      {
        type: 'text',
        text: systemPromptParts.join('\n\n'),
        cacheControl: EPHEMERAL,
      },
    ];

    // ── Layer 2: Tool definitions (frozen at session start) ──

    const tools = this.getToolsWithCacheControl();

    // ── Layer 3: Project config as first message pair ──

    const assembledMessages: Message[] = [];

    if (this.projectConfig?.instructions) {
      // Project instructions are sent as the first user message
      // with cache_control for per-project caching
      let projectText = this.projectConfig.instructions;

      if (this.projectConfig.mcpInstructions) {
        projectText += `\n\n${this.projectConfig.mcpInstructions}`;
      }

      assembledMessages.push({
        role: 'user',
        content: [{ type: 'text', text: projectText }],
        metadata: { anchor: true },
      });

      assembledMessages.push({
        role: 'assistant',
        content: [{ type: 'text', text: 'Understood. I will follow these project instructions.' }],
      });
    }

    // ── Layer 4: Conversation messages ──

    assembledMessages.push(...messages);

    // ── Layer 5: System reminders (inject into latest user message) ──

    if (reminders.length > 0) {
      this.injectReminders(assembledMessages, reminders);
    }

    // ── Assemble final params ──

    const params: MessageParams = {
      model: overrides?.model ?? this.config.defaultModel,
      system,
      messages: assembledMessages,
      tools: tools.length > 0 ? tools : undefined,
      maxTokens: overrides?.maxTokens ?? this.config.defaultMaxTokens,
      temperature: overrides?.temperature ?? this.config.temperature,
      thinking: overrides?.thinking ?? this.config.thinking,
    };

    return {
      params,
      meta: {
        systemTokensEstimate: this.estimateTokens(systemPromptParts.join('\n\n')),
        toolCount: tools.length,
        messageCount: assembledMessages.length,
        hasProjectConfig: this.projectConfig !== null,
        reminderCount: reminders.length,
      },
    };
  }

  /**
   * Build a compaction request that preserves the cache prefix.
   * The system prompt and tools remain IDENTICAL to normal requests.
   */
  buildCompactionRequest(
    messagesToSummarize: Message[],
    _recentMessages: Message[],
  ): AssembledRequest {
    const compactionInstruction: Message = {
      role: 'user',
      content: [
        {
          type: 'text',
          text:
            'Summarize the conversation above concisely. Include:\n' +
            '- Key decisions and their rationale\n' +
            '- Files that were modified and why\n' +
            '- Current state of the task\n' +
            '- Any important context needed to continue\n' +
            'Be brief but preserve critical information.',
        },
      ],
    };

    const allMessages = [...messagesToSummarize, compactionInstruction];

    return this.build(allMessages, [], {
      maxTokens: 4096,
      thinking: undefined,
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Get frozen tools with cache_control on the last tool.
   */
  private getToolsWithCacheControl(): ToolSchema[] {
    if (!this.frozenTools || this.frozenTools.length === 0) {
      return [];
    }

    // Add cache_control to the LAST tool definition
    // (maximizes the cached prefix through all tools)
    return this.frozenTools.map((tool, i) => {
      if (i === this.frozenTools!.length - 1) {
        return { ...tool, cacheControl: EPHEMERAL };
      }
      return tool;
    });
  }

  /**
   * Inject system reminders into the latest user message.
   * Reminders are wrapped in <system-reminder> tags.
   * NEVER injected into the system prompt (that would break cache).
   */
  private injectReminders(messages: Message[], reminders: SystemReminder[]): void {
    // Find the last user message
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'user') {
        lastUserIdx = i;
        break;
      }
    }

    if (lastUserIdx === -1) {
      // No user message to inject into — create one
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: reminders
              .map((r) => `<system-reminder>\n${r.text}\n</system-reminder>`)
              .join('\n'),
          },
        ],
      });
      return;
    }

    // Append reminders to the last user message's content
    const lastUserMsg = messages[lastUserIdx]!;
    const reminderText = reminders
      .map((r) => `<system-reminder>\n${r.text}\n</system-reminder>`)
      .join('\n');

    lastUserMsg.content = [
      ...lastUserMsg.content,
      { type: 'text', text: reminderText },
    ];
  }

  /**
   * Rough token estimate (4 chars ≈ 1 token).
   * For accurate counts, use the provider's countTokens method.
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
