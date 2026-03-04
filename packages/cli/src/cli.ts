#!/usr/bin/env node

/**
 * Mimi CLI — Entry point.
 *
 * Usage:
 *   mimi                    Interactive REPL mode
 *   mimi "prompt"           One-shot mode
 *   mimi --continue         Resume last session
 *   mimi --model <model>    Override model
 *   mimi --print            Print-only mode (no tools)
 */

import { Command } from 'commander';
import { setupContainer } from './container-setup.js';
import { Repl } from './repl.js';
import { banner, bannerPlain, goodbye } from '@mimi/brand';

const program = new Command();

program
  .name('mimi')
  .description('Mimi — An open-source CLI agent')
  .version('0.1.0')
  .argument('[prompt]', 'One-shot prompt (omit for interactive mode)')
  .option('-m, --model <model>', 'Model to use')
  .option('--max-tokens <n>', 'Maximum output tokens', parseInt)
  .option('--continue', 'Resume the last session')
  .option('--brand <path>', 'Path to brand.json')
  .option('--print', 'Print-only mode (no tool execution)')
  .option('--verbose', 'Verbose output')
  .action(async (prompt: string | undefined, options: {
    model?: string;
    maxTokens?: number;
    continue?: boolean;
    brand?: string;
    print?: boolean;
    verbose?: boolean;
  }) => {
    try {
      const projectPath = process.cwd();

      // Setup container
      const setup = await setupContainer({
        projectPath,
        cliFlags: {
          ...(options.model ? { model: options.model } : {}),
          ...(options.maxTokens ? { maxTokens: options.maxTokens } : {}),
        },
        brandPath: options.brand,
      });

      // Display banner
      const hasColor = process.stdout.isTTY && !process.env['NO_COLOR'];
      const version = program.version() ?? '0.1.0';
      process.stdout.write(hasColor ? banner(version) : bannerPlain(version));

      if (prompt) {
        // One-shot mode
        const repl = new Repl(setup);
        await repl.handleOneShot(prompt);

        // Cleanup
        setup.sessionStore.close();
        await setup.mcpClient.dispose();
        setup.eventBus.dispose();
      } else {
        // Interactive REPL mode
        const repl = new Repl(setup);

        // Handle graceful shutdown
        process.on('SIGINT', () => {
          process.stdout.write('\n');
          repl.stop();
        });

        process.on('SIGTERM', () => {
          repl.stop();
        });

        await repl.start();

        // Goodbye
        process.stdout.write(goodbye());

        // Cleanup
        setup.sessionStore.close();
        await setup.mcpClient.dispose();
        setup.eventBus.dispose();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });

program.parse();
