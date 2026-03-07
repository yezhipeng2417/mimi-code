/**
 * REPL — Read-Eval-Print Loop for interactive sessions.
 *
 * Handles user input, slash commands, and agent loop orchestration.
 */

import * as readline from 'node:readline';
import { AgentLoop, Tokens, UsageTracker } from '@mimi/core';
import type { LLMProvider, Message } from '@mimi/core';
import type { PermissionPrompt } from '@mimi/core';
import type { SetupResult } from './container-setup.js';
import { ToolBridge } from './tool-bridge.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { promptIcon, promptIconPlain } from '@mimi/brand';

export interface ReplOptions {
  printOnly?: boolean;
}

export class Repl {
  private setup: SetupResult;
  private messages: Message[] = [];
  private rl: readline.Interface | null = null;
  private sessionId: string;
  private running = false;
  private provider: LLMProvider | null = null;
  private agentLoop: AgentLoop | null = null;
  private printOnly: boolean;

  constructor(setup: SetupResult, resumeSessionId?: string, options?: ReplOptions) {
    this.printOnly = options?.printOnly ?? false;
    this.setup = setup;

    if (resumeSessionId) {
      // Resume existing session
      this.sessionId = resumeSessionId;
      this.messages = setup.sessionStore.getMessages(resumeSessionId);
      setup.sessionStore.updateSession(resumeSessionId, { status: 'active' });
    } else {
      // Create a new session
      const session = setup.sessionStore.createSession(
        process.cwd(),
        setup.config.model,
      );
      this.sessionId = session.id;
    }
  }

  /**
   * Start the REPL loop.
   */
  async start(): Promise<void> {
    this.running = true;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Initialize provider
    this.initProvider();

    // Start usage tracking
    new UsageTracker(this.setup.eventBus, this.setup.config.model);

    // Display welcome
    const welcome = this.setup.brand.welcomeMessage ?? `Welcome to ${this.setup.brand.name}!`;
    process.stdout.write(`\n${welcome}\n\n`);

    if (!this.provider) {
      process.stdout.write('⚠ No API key found. Set ANTHROPIC_API_KEY to enable AI responses.\n\n');
    }

    // Display available skills
    const skills = this.setup.skillLoader.listUserInvocable();
    if (skills.length > 0) {
      const skillList = skills.map((s) => `  /${s.name}`).join('\n');
      process.stdout.write(`Available commands:\n${skillList}\n  /help\n  /quit\n\n`);
    }

    // Subscribe to stream events for terminal output
    this.setupStreamHandlers();

    // Main loop
    while (this.running) {
      const icon = process.stdout.isTTY ? promptIcon() : promptIconPlain();
      const input = await this.prompt(`${icon} `);
      if (input === null) break; // EOF

      const trimmed = input.trim();
      if (!trimmed) continue;

      // Handle slash commands
      if (trimmed.startsWith('/')) {
        await this.handleSlashCommand(trimmed);
        continue;
      }

      // Regular user message
      await this.handleUserMessage(trimmed);
    }

    this.cleanup();
  }

  /**
   * Handle a one-shot prompt (non-interactive).
   */
  async handleOneShot(prompt: string): Promise<void> {
    this.initProvider();
    this.setupStreamHandlers();
    await this.handleUserMessage(prompt);
  }

  /**
   * Stop the REPL.
   */
  stop(): void {
    this.running = false;
    if (this.agentLoop) {
      this.agentLoop.cancel();
    }
    this.rl?.close();
  }

  // ── Private ─────────────────────────────────────────────────────────

  private initProvider(): void {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) return;

    this.provider = new AnthropicProvider({
      apiKey,
      defaultModel: this.setup.config.model,
    });

    // Wire agent orchestrator with the ability to run sub-agents
    this.setup.agentOrchestrator.setRunFn(async (request) => {
      if (!this.provider) {
        throw new Error('No provider available for sub-agent');
      }

      const startTime = Date.now();

      // Create a child session for the sub-agent
      const childSession = this.setup.sessionStore.createSession(
        process.cwd(),
        request.model ?? request.typeConfig.model ?? this.setup.config.model,
        `Sub-agent: ${request.type}`,
      );

      // Create a child prompt assembler with the agent's system prompt
      const childAssembler = new (await import('@mimi/core')).PromptAssembler({
        coreSystemPrompt: request.typeConfig.systemPrompt,
        defaultModel: request.model ?? request.typeConfig.model ?? this.setup.config.model,
        defaultMaxTokens: this.setup.config.maxTokens,
      });

      // Freeze tools for child assembler
      const toolSchemas = await this.setup.toolRegistry.listToolSchemas();
      childAssembler.freezeTools(toolSchemas);

      // Create tool bridge for the sub-agent
      const toolBridge = new ToolBridge({
        registry: this.setup.toolRegistry,
        executor: this.setup.toolExecutor,
        permissionEngine: this.setup.permissionEngine,
        eventBus: this.setup.eventBus,
        resourceManager: this.setup.container.resolve(Tokens.ResourceManager),
        workingDirectory: process.cwd(),
        sessionId: childSession.id,
      });

      // Create permission prompt that auto-denies for sub-agents
      const childPermission: PermissionPrompt = {
        ask: async () => ({ allowed: false, persist: false }),
      };

      // Create child agent loop
      const childLoop = new AgentLoop({
        provider: this.provider,
        assembler: childAssembler,
        sessionStore: this.setup.sessionStore,
        eventBus: this.setup.eventBus,
        resourceManager: this.setup.container.resolve(Tokens.ResourceManager),
        toolExecutor: toolBridge,
        permissionPrompt: childPermission,
        hookRunner: this.setup.hookRunner,
        sessionId: childSession.id,
        maxTurns: request.maxTurns ?? request.typeConfig.maxTurns ?? 30,
      });

      try {
        const messages = await childLoop.run(request.prompt);

        // Extract final text response
        const lastAssistant = messages.filter((m) => m.role === 'assistant').pop();
        const responseText = lastAssistant?.content
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map((b) => b.text)
          .join('\n') ?? '';

        return {
          agentId: request.agentId,
          type: request.type,
          response: responseText,
          success: true,
          totalTokens: 0,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        return {
          agentId: request.agentId,
          type: request.type,
          response: `Agent error: ${errMsg}`,
          success: false,
          totalTokens: 0,
          durationMs: Date.now() - startTime,
          error: errMsg,
        };
      }
    });
  }

  private setupStreamHandlers(): void {
    const { eventBus } = this.setup;

    // Print text deltas as they stream in
    eventBus.on('stream:delta', ({ text }) => {
      process.stdout.write(text);
    });

    // Print newline when stream ends
    eventBus.on('stream:stop', () => {
      process.stdout.write('\n\n');
    });

    // Tool execution status
    eventBus.on('tool:start', ({ toolName }) => {
      process.stdout.write(`\x1b[90m⚙ ${toolName}...\x1b[0m\n`);
    });

    eventBus.on('tool:end', ({ toolName, durationMs }) => {
      process.stdout.write(`\x1b[90m✓ ${toolName} (${durationMs}ms)\x1b[0m\n`);
    });

    eventBus.on('tool:error', ({ toolName, error }) => {
      process.stderr.write(`\x1b[31m✗ ${toolName}: ${error.message}\x1b[0m\n`);
    });

    eventBus.on('tool:permission', ({ toolName }) => {
      process.stdout.write(`\x1b[33m🔒 ${toolName} requires permission\x1b[0m\n`);
    });

    // MCP connection status
    eventBus.on('mcp:connected', ({ serverName, toolCount }) => {
      process.stderr.write(`\x1b[90m✓ MCP ${serverName}: ${toolCount} tools\x1b[0m\n`);
    });
    eventBus.on('mcp:error', ({ serverName, error }) => {
      process.stderr.write(`\x1b[31m✗ MCP ${serverName}: ${error}\x1b[0m\n`);
    });

    // Usage summary
    eventBus.on('usage:update', ({ totalInputTokens, totalOutputTokens, totalCostUsd, cacheHitRate }) => {
      const total = totalInputTokens + totalOutputTokens;
      const tokenStr = total > 1000 ? `${(total / 1000).toFixed(1)}k` : String(total);
      const cacheStr = cacheHitRate > 0 ? ` cache: ${(cacheHitRate * 100).toFixed(0)}%` : '';
      process.stdout.write(`\x1b[90m${tokenStr} tokens · $${totalCostUsd.toFixed(4)}${cacheStr}\x1b[0m\n`);
    });
  }

  private async handleUserMessage(text: string): Promise<void> {
    if (!this.provider) {
      process.stdout.write('\n⚠ No provider connected. Set ANTHROPIC_API_KEY.\n\n');
      return;
    }

    try {
      process.stdout.write('\n');

      if (this.printOnly) {
        // Print-only mode: stream response without tool support
        await this.handlePrintOnly(text);
        return;
      }

      // Create tool bridge
      const toolBridge = new ToolBridge({
        registry: this.setup.toolRegistry,
        executor: this.setup.toolExecutor,
        permissionEngine: this.setup.permissionEngine,
        eventBus: this.setup.eventBus,
        resourceManager: this.setup.container.resolve(Tokens.ResourceManager),
        workingDirectory: process.cwd(),
        sessionId: this.sessionId,
      });

      // Create permission prompt (simple stdin-based)
      const permissionPrompt: PermissionPrompt = {
        ask: async (toolName: string, input: unknown) => {
          const inputStr = typeof input === 'object'
            ? JSON.stringify(input, null, 2).slice(0, 200)
            : String(input);
          const answer = await this.prompt(
            `\x1b[33mAllow ${toolName}?\x1b[0m ${inputStr}\n(y/n) `,
          );
          return {
            allowed: answer?.toLowerCase().startsWith('y') ?? false,
            persist: false,
          };
        },
      };

      // Create agent loop
      this.agentLoop = new AgentLoop({
        provider: this.provider,
        assembler: this.setup.promptAssembler,
        sessionStore: this.setup.sessionStore,
        eventBus: this.setup.eventBus,
        resourceManager: this.setup.container.resolve(Tokens.ResourceManager),
        toolExecutor: toolBridge,
        permissionPrompt,
        hookRunner: this.setup.hookRunner,
        sessionId: this.sessionId,
      });

      // Load existing messages into agent loop
      if (this.messages.length > 0) {
        this.agentLoop.loadMessages(this.messages);
      }

      // Run agent loop — it internally manages user + assistant messages
      await this.agentLoop.run(text);

      // Sync messages from agent loop (single source of truth)
      this.messages = [...this.agentLoop.allMessages];

      this.agentLoop = null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`\x1b[31mError: ${message}\x1b[0m\n\n`);
    }
  }

  /**
   * Print-only mode: send messages without tools, just stream the response.
   */
  private async handlePrintOnly(text: string): Promise<void> {
    if (!this.provider) return;

    // Add user message
    this.messages.push({
      role: 'user',
      content: [{ type: 'text', text }],
      metadata: { timestamp: Date.now() },
    });

    // Build params without tools
    const assembled = this.setup.promptAssembler.build(this.messages, []);
    const params = { ...assembled.params, tools: undefined };

    // Stream response
    let responseText = '';
    for await (const event of this.provider.createMessage(params)) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        process.stdout.write(event.delta.text);
        responseText += event.delta.text;
      }
      if (event.type === 'message_delta' && event.usage) {
        this.setup.eventBus.emit('stream:stop', {
          stopReason: event.stopReason,
          usage: event.usage,
        });
      }
    }

    process.stdout.write('\n\n');

    // Save assistant message
    this.messages.push({
      role: 'assistant',
      content: [{ type: 'text', text: responseText }],
      metadata: { timestamp: Date.now() },
    });
  }

  private async handleSlashCommand(input: string): Promise<void> {
    const parts = input.slice(1).split(/\s+/);
    const command = parts[0]!;
    const args = parts.slice(1).join(' ');

    switch (command) {
      case 'quit':
      case 'exit':
        this.running = false;
        process.stdout.write('Goodbye!\n');
        break;

      case 'help':
        this.printHelp();
        break;

      case 'clear':
        this.messages = [];
        process.stdout.write('Conversation cleared.\n\n');
        break;

      case 'status': {
        const toolNames = this.setup.toolRegistry.getToolNames();
        const mcpStates = this.setup.mcpClient.getServerStates();
        process.stdout.write(`Model: ${this.setup.config.model}\n`);
        process.stdout.write(`Tools: ${toolNames.length}\n`);
        process.stdout.write(`MCP Servers: ${mcpStates.size}\n`);
        process.stdout.write(`Messages: ${this.messages.length}\n`);
        process.stdout.write(`Session: ${this.sessionId}\n`);
        if (this.printOnly) {
          process.stdout.write('Mode: print-only (no tools)\n');
        }
        if (this.provider) {
          process.stdout.write(`Provider: ${this.provider.name}\n`);
        } else {
          process.stdout.write('Provider: not connected\n');
        }
        process.stdout.write('\n');
        break;
      }

      case 'compact':
        await this.handleCompact();
        break;

      case 'model': {
        if (args) {
          this.setup.config.model = args;
          // Reinitialize provider with the new model
          this.initProvider();
          process.stdout.write(`Model switched to: ${args}\n\n`);
        } else {
          process.stdout.write(`Current model: ${this.setup.config.model}\n\n`);
        }
        break;
      }

      default: {
        // Try skill
        const result = this.setup.skillRunner.run(command, args || undefined);
        if (result) {
          process.stdout.write(`Running skill: ${command}\n`);
          await this.handleUserMessage(result.expandedPrompt);
        } else {
          process.stdout.write(`Unknown command: /${command}. Type /help for available commands.\n\n`);
        }
        break;
      }
    }
  }

  private async handleCompact(): Promise<void> {
    if (!this.provider) {
      process.stdout.write('Cannot compact: no provider connected.\n\n');
      return;
    }

    const tokenCount = await this.provider.countTokens(this.messages);
    process.stdout.write(`\x1b[90mCurrent context: ~${(tokenCount / 1000).toFixed(1)}k tokens, ${this.messages.length} messages\x1b[0m\n`);

    if (this.messages.length < 6) {
      process.stdout.write('Not enough messages to compact.\n\n');
      return;
    }

    process.stdout.write('\x1b[90mCompacting...\x1b[0m\n');

    // Create a temporary agent loop just for compaction
    const toolBridge = new ToolBridge({
      registry: this.setup.toolRegistry,
      executor: this.setup.toolExecutor,
      permissionEngine: this.setup.permissionEngine,
      eventBus: this.setup.eventBus,
      resourceManager: this.setup.container.resolve(Tokens.ResourceManager),
      workingDirectory: process.cwd(),
      sessionId: this.sessionId,
    });

    const permissionPrompt: PermissionPrompt = {
      ask: async () => ({ allowed: false, persist: false }),
    };

    const tempLoop = new AgentLoop({
      provider: this.provider,
      assembler: this.setup.promptAssembler,
      sessionStore: this.setup.sessionStore,
      eventBus: this.setup.eventBus,
      resourceManager: this.setup.container.resolve(Tokens.ResourceManager),
      toolExecutor: toolBridge,
      permissionPrompt,
      hookRunner: this.setup.hookRunner,
      sessionId: this.sessionId,
      compactionThreshold: 0, // Force compaction
    });
    tempLoop.loadMessages(this.messages);

    // The compact method is private, so we trigger it via a run with very low threshold
    // Actually, let's just build a compaction request directly
    const compactable = this.messages.filter((m) => !m.metadata?.anchor && !m.metadata?.compactionSummary);
    const compactionReq = this.setup.promptAssembler.buildCompactionRequest(compactable, []);

    let summaryText = '';
    for await (const event of this.provider.createMessage(compactionReq.params)) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        summaryText += event.delta.text;
      }
    }

    // Rebuild messages
    const anchors = this.messages.filter((m) => m.metadata?.anchor);
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
    ];

    const newTokenCount = await this.provider.countTokens(this.messages);
    process.stdout.write(`\x1b[32m✓ Compacted to ~${(newTokenCount / 1000).toFixed(1)}k tokens, ${this.messages.length} messages\x1b[0m\n\n`);
  }

  private printHelp(): void {
    process.stdout.write(`
Commands:
  /help      Show this help
  /quit      Exit the session
  /clear     Clear conversation history
  /status    Show session status
  /compact   Compact conversation to save context
  /model [m] Show or switch model

Skills:
`);
    const skills = this.setup.skillLoader.listUserInvocable();
    if (skills.length > 0) {
      for (const skill of skills) {
        process.stdout.write(`  /${skill.name}  ${skill.description}\n`);
      }
    } else {
      process.stdout.write('  (no skills loaded)\n');
    }
    process.stdout.write('\n');
  }

  private prompt(promptStr: string): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.rl) {
        resolve(null);
        return;
      }
      this.rl.question(promptStr, (answer) => {
        resolve(answer);
      });
      this.rl.once('close', () => resolve(null));
    });
  }

  private cleanup(): void {
    this.rl?.close();
    this.setup.sessionStore.updateSession(this.sessionId, { status: 'completed' });
  }
}
