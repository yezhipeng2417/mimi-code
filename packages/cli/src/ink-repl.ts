/**
 * InkRepl — Interactive REPL using Ink for terminal rendering.
 *
 * Used when running in a TTY with color support. Falls back to plain
 * Repl for piped/non-interactive scenarios.
 */

import React from 'react';
import { render } from 'ink';
import { AgentLoop, Tokens, UsageTracker } from '@mimi/core';
import type { LLMProvider, Message } from '@mimi/core';
import type { PermissionPrompt } from '@mimi/core';
import type { SetupResult } from './container-setup.js';
import { ToolBridge } from './tool-bridge.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { MimiApp } from '@mimi/ui';
import { banner, bannerPlain } from '@mimi/brand';

export class InkRepl {
  private setup: SetupResult;
  private messages: Message[] = [];
  private sessionId: string;
  private provider: LLMProvider | null = null;
  private agentLoop: AgentLoop | null = null;
  private inkInstance: ReturnType<typeof render> | null = null;
  private pendingPermission: {
    toolName: string;
    input: unknown;
    resolve: (decision: { allowed: boolean; persist: boolean }) => void;
  } | null = null;

  constructor(setup: SetupResult, resumeSessionId?: string) {
    this.setup = setup;

    if (resumeSessionId) {
      this.sessionId = resumeSessionId;
      this.messages = setup.sessionStore.getMessages(resumeSessionId);
      setup.sessionStore.updateSession(resumeSessionId, { status: 'active' });
    } else {
      const session = setup.sessionStore.createSession(
        process.cwd(),
        setup.config.model,
      );
      this.sessionId = session.id;
    }
  }

  async start(): Promise<void> {
    this.initProvider();

    // Start usage tracking (kept alive by eventBus subscription)
    new UsageTracker(this.setup.eventBus, this.setup.config.model);

    const hasColor = process.stdout.isTTY && !process.env['NO_COLOR'];
    const bannerText = hasColor ? banner('0.1.0') : bannerPlain('0.1.0');

    // Render Ink app
    const app = React.createElement(MimiApp, {
      bannerText,
      productName: this.setup.brand.name,
      version: '0.1.0',
      welcomeMessage: this.setup.brand.welcomeMessage,
      model: this.setup.config.model,
      onSubmit: (text: string) => this.handleInput(text),
      onExit: () => this.stop(),
      eventBus: this.setup.eventBus as {
        on(event: string, handler: (...args: unknown[]) => void): void;
        off(event: string, handler: (...args: unknown[]) => void): void;
      },
    });

    this.inkInstance = render(app);

    // Wait for the Ink app to unmount
    await this.inkInstance.waitUntilExit();
  }

  stop(): void {
    if (this.agentLoop) {
      this.agentLoop.cancel();
    }
    this.cleanup();
    this.inkInstance?.unmount();
  }

  // ── Private ─────────────────────────────────────────────────────────

  private initProvider(): void {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) return;

    this.provider = new AnthropicProvider({
      apiKey,
      defaultModel: this.setup.config.model,
    });

    // Wire agent orchestrator (same as plain Repl)
    this.setup.agentOrchestrator.setRunFn(async (request) => {
      if (!this.provider) {
        throw new Error('No provider available for sub-agent');
      }

      const startTime = Date.now();
      const childSession = this.setup.sessionStore.createSession(
        process.cwd(),
        request.model ?? request.typeConfig.model ?? this.setup.config.model,
        `Sub-agent: ${request.type}`,
      );

      const { PromptAssembler } = await import('@mimi/core');
      const childAssembler = new PromptAssembler({
        coreSystemPrompt: request.typeConfig.systemPrompt,
        defaultModel: request.model ?? request.typeConfig.model ?? this.setup.config.model,
        defaultMaxTokens: this.setup.config.maxTokens,
      });

      const toolSchemas = await this.setup.toolRegistry.listToolSchemas();
      childAssembler.freezeTools(toolSchemas);

      const toolBridge = new ToolBridge({
        registry: this.setup.toolRegistry,
        executor: this.setup.toolExecutor,
        permissionEngine: this.setup.permissionEngine,
        eventBus: this.setup.eventBus,
        resourceManager: this.setup.container.resolve(Tokens.ResourceManager),
        workingDirectory: process.cwd(),
        sessionId: childSession.id,
      });

      const childPermission: PermissionPrompt = {
        ask: async () => ({ allowed: false, persist: false }),
      };

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

  private async handleInput(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Handle slash commands
    if (trimmed.startsWith('/')) {
      await this.handleSlashCommand(trimmed);
      return;
    }

    await this.handleUserMessage(trimmed);
  }

  private async handleUserMessage(text: string): Promise<void> {
    if (!this.provider) return;

    try {
      this.setup.eventBus.emit('agent:state_change', { from: 'IDLE', to: 'ASSEMBLING' });

      const toolBridge = new ToolBridge({
        registry: this.setup.toolRegistry,
        executor: this.setup.toolExecutor,
        permissionEngine: this.setup.permissionEngine,
        eventBus: this.setup.eventBus,
        resourceManager: this.setup.container.resolve(Tokens.ResourceManager),
        workingDirectory: process.cwd(),
        sessionId: this.sessionId,
      });

      // Permission prompt — stores resolve callback for MimiApp to call
      const permissionPrompt: PermissionPrompt = {
        ask: async (toolName: string, input: unknown) => {
          this.setup.eventBus.emit('tool:permission', {
            toolName,
            decision: 'ask',
          });
          return new Promise<{ allowed: boolean; persist: boolean }>((resolve) => {
            this.pendingPermission = { toolName, input, resolve };
          });
        },
      };

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

      if (this.messages.length > 0) {
        this.agentLoop.loadMessages(this.messages);
      }

      await this.agentLoop.run(text);
      this.messages = [...this.agentLoop.allMessages];
      this.agentLoop = null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.setup.eventBus.emit('tool:error', {
        toolName: 'agent',
        error: new Error(message),
      });
    }
  }

  private async handleSlashCommand(input: string): Promise<void> {
    const parts = input.slice(1).split(/\s+/);
    const command = parts[0]!;
    const args = parts.slice(1).join(' ');

    switch (command) {
      case 'quit':
      case 'exit':
        this.stop();
        break;

      case 'clear':
        this.messages = [];
        break;

      case 'compact':
        await this.handleCompact();
        break;

      case 'model':
        if (args) {
          this.setup.config.model = args;
          this.initProvider();
        }
        break;

      default: {
        const result = this.setup.skillRunner.run(command, args || undefined);
        if (result) {
          await this.handleUserMessage(result.expandedPrompt);
        }
        break;
      }
    }
  }

  private async handleCompact(): Promise<void> {
    if (!this.provider || this.messages.length < 6) return;

    const compactable = this.messages.filter((m) => !m.metadata?.anchor && !m.metadata?.compactionSummary);
    const compactionReq = this.setup.promptAssembler.buildCompactionRequest(compactable, []);

    let summaryText = '';
    for await (const event of this.provider.createMessage(compactionReq.params)) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        summaryText += event.delta.text;
      }
    }

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
  }

  /** Resolve any pending permission request (deny on cleanup). */
  private cleanup(): void {
    if (this.pendingPermission) {
      this.pendingPermission.resolve({ allowed: false, persist: false });
      this.pendingPermission = null;
    }
    this.setup.sessionStore.updateSession(this.sessionId, { status: 'completed' });
  }
}
