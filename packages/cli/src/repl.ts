/**
 * REPL — Read-Eval-Print Loop for interactive sessions.
 *
 * Handles user input, slash commands, and agent loop orchestration.
 */

import * as readline from 'node:readline';
import type { Message } from '@mimi/core';
import type { SetupResult } from './container-setup.js';

export class Repl {
  private setup: SetupResult;
  private messages: Message[] = [];
  private rl: readline.Interface | null = null;
  private sessionId: string;
  private running = false;

  constructor(setup: SetupResult) {
    this.setup = setup;

    // Create a session
    const session = setup.sessionStore.createSession(
      process.cwd(),
      setup.config.model,
    );
    this.sessionId = session.id;
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

    // Display welcome
    const welcome = this.setup.brand.welcomeMessage ?? `Welcome to ${this.setup.brand.name}!`;
    process.stdout.write(`\n${welcome}\n\n`);

    // Display available skills
    const skills = this.setup.skillLoader.listUserInvocable();
    if (skills.length > 0) {
      const skillList = skills.map((s) => `  /${s.name}`).join('\n');
      process.stdout.write(`Available commands:\n${skillList}\n  /help\n  /quit\n\n`);
    }

    // Main loop
    while (this.running) {
      const input = await this.prompt('❯ ');
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
   * Stop the REPL.
   */
  stop(): void {
    this.running = false;
    this.rl?.close();
  }

  // ── Private ─────────────────────────────────────────────────────────

  private async handleUserMessage(text: string): Promise<void> {
    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: [{ type: 'text', text }],
    };
    this.messages.push(userMessage);
    this.setup.sessionStore.saveMessage(this.sessionId, userMessage);

    // Run agent loop
    try {
      process.stdout.write('\n');

      // Build the prompt and stream
      const assembled = this.setup.promptAssembler.build(this.messages);

      // For now, output a placeholder since we need a provider implementation
      // The actual streaming will use AgentLoop.run() when a provider is connected
      process.stdout.write(`[${this.setup.config.model}] Processing with ${assembled.meta.toolCount} tools...\n`);
      process.stdout.write('(Provider not yet connected. Connect an Anthropic API key to enable responses.)\n\n');

      // In a real implementation, this would be:
      // const loop = new AgentLoop({ ... });
      // const assistantMessage = await loop.run(userMessage);
      // this.messages.push(assistantMessage);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n\n`);
    }
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
        process.stdout.write(`Session: ${this.sessionId}\n\n`);
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

  private printHelp(): void {
    process.stdout.write(`
Commands:
  /help     Show this help
  /quit     Exit the session
  /clear    Clear conversation history
  /status   Show session status

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
