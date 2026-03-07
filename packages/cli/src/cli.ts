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
import { InkRepl } from './ink-repl.js';
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
  .option('--no-ink', 'Disable Ink TUI (use plain readline REPL)')
  .action(async (prompt: string | undefined, options: {
    model?: string;
    maxTokens?: number;
    continue?: boolean;
    brand?: string;
    print?: boolean;
    verbose?: boolean;
    ink?: boolean;
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

      // Resolve session ID for --continue
      let resumeSessionId: string | undefined;
      if (options.continue) {
        const lastSession = setup.sessionStore.getLastSession(projectPath);
        if (lastSession) {
          resumeSessionId = lastSession.id;
          process.stdout.write(`\x1b[90mResuming session: ${lastSession.title} (${lastSession.id.slice(0, 8)}...)\x1b[0m\n`);
        } else {
          process.stdout.write('\x1b[33mNo previous session found. Starting new session.\x1b[0m\n');
        }
      }

      if (prompt) {
        // One-shot mode
        const repl = new Repl(setup, resumeSessionId, { printOnly: options.print });
        await repl.handleOneShot(prompt);

        // Cleanup
        setup.sessionStore.close();
        await setup.mcpClient.dispose();
        setup.eventBus.dispose();
      } else {
        // Interactive REPL mode
        const useInk = options.ink !== false && process.stdout.isTTY && !process.env['NO_COLOR'];

        if (useInk) {
          // Ink-based TUI
          const inkRepl = new InkRepl(setup, resumeSessionId);

          process.on('SIGINT', () => inkRepl.stop());
          process.on('SIGTERM', () => inkRepl.stop());

          await inkRepl.start();
        } else {
          // Plain readline REPL (for pipes and non-TTY)
          const repl = new Repl(setup, resumeSessionId, { printOnly: options.print });

          process.on('SIGINT', () => {
            process.stdout.write('\n');
            repl.stop();
          });

          process.on('SIGTERM', () => repl.stop());

          await repl.start();
        }

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

// ── Doctor subcommand ──────────────────────────────────────────────────
program
  .command('doctor')
  .description('Check system health and configuration')
  .action(async () => {
    const checks: Array<{ name: string; status: 'ok' | 'warn' | 'fail'; detail: string }> = [];

    // Node version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split('.')[0]!, 10);
    checks.push({
      name: 'Node.js',
      status: major >= 18 ? 'ok' : 'fail',
      detail: `${nodeVersion}${major < 18 ? ' (requires >= 18)' : ''}`,
    });

    // API key
    const hasKey = !!process.env['ANTHROPIC_API_KEY'];
    checks.push({
      name: 'ANTHROPIC_API_KEY',
      status: hasKey ? 'ok' : 'warn',
      detail: hasKey ? 'Set' : 'Not set — AI features will be unavailable',
    });

    // Project config
    const cwd = process.cwd();
    const { loadConfig, loadProjectInstructions } = await import('./config.js');
    const config = await loadConfig({ projectPath: cwd });
    checks.push({
      name: 'Config',
      status: 'ok',
      detail: `model=${config.model}, maxTokens=${config.maxTokens}`,
    });

    // Project instructions
    const instructions = await loadProjectInstructions(cwd);
    checks.push({
      name: 'Project instructions',
      status: instructions ? 'ok' : 'warn',
      detail: instructions ? 'Found' : 'No MIMI.md or CLAUDE.md found',
    });

    // MCP servers
    const { loadMcpServers } = await import('./config.js');
    const mcpServers = await loadMcpServers(cwd);
    const serverCount = Object.keys(mcpServers).length;
    checks.push({
      name: 'MCP servers',
      status: 'ok',
      detail: serverCount > 0 ? `${serverCount} configured` : 'None configured',
    });

    // Output
    const icons = { ok: '\x1b[32m✔\x1b[0m', warn: '\x1b[33m▲\x1b[0m', fail: '\x1b[31m✘\x1b[0m' };

    process.stdout.write('\n  Mimi Doctor\n\n');
    for (const check of checks) {
      process.stdout.write(`  ${icons[check.status]} ${check.name}: ${check.detail}\n`);
    }

    const hasFailure = checks.some((c) => c.status === 'fail');
    process.stdout.write('\n');
    if (hasFailure) {
      process.stdout.write('  \x1b[31mSome checks failed. Fix the issues above.\x1b[0m\n\n');
      process.exit(1);
    } else {
      process.stdout.write('  \x1b[32mAll checks passed.\x1b[0m\n\n');
    }
  });

program.parse();
