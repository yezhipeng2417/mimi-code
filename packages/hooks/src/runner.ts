/**
 * HookRunner — Executes hooks in response to events.
 *
 * Hooks are shell commands executed at specific lifecycle points.
 * They can:
 *   - Block execution (blocking: true)
 *   - Modify tool input (action: 'modify')
 *   - Inject tool results (action: 'block' with injectedResult)
 *   - Just observe (fire and forget)
 */

import { execFile } from 'node:child_process';
import type { EventBusLike, HookEvent, HookResult } from '@mimi/core';
import type { HookConfig, HookContext, HookExecutionResult } from './types.js';

const DEFAULT_TIMEOUT = 10_000;

export class HookRunner {
  private hooks: HookConfig[] = [];
  private eventBus?: EventBusLike;

  constructor(hooks?: HookConfig[], eventBus?: EventBusLike) {
    this.hooks = hooks ?? [];
    this.eventBus = eventBus;
  }

  /**
   * Register a hook configuration.
   */
  registerHook(config: HookConfig): void {
    this.hooks.push(config);
  }

  /**
   * Load hooks from config array.
   */
  loadHooks(configs: HookConfig[]): void {
    this.hooks = [...configs];
  }

  /**
   * Fire hooks for a given event.
   * Returns results from blocking hooks.
   */
  async fire(
    event: HookEvent,
    context: HookContext,
  ): Promise<HookResult> {
    const matchingHooks = this.hooks.filter((h) => {
      if (h.event !== event) return false;
      if (h.toolName && context.toolName && h.toolName !== context.toolName) return false;
      return true;
    });

    if (matchingHooks.length === 0) {
      return { action: 'continue' };
    }

    for (const hook of matchingHooks) {
      const result = await this.executeHook(hook, context);

      this.eventBus?.emit('hook:fired', {
        event,
        hookName: hook.command,
      });

      // Blocking hooks can modify behavior
      if (hook.blocking && result.result.action !== 'continue') {
        if (result.result.action === 'block') {
          this.eventBus?.emit('hook:blocked', {
            event,
            hookName: hook.command,
            reason: result.result.message ?? 'Blocked by hook',
          });
        }
        return result.result;
      }
    }

    return { action: 'continue' };
  }

  /**
   * Get all registered hooks.
   */
  getHooks(): readonly HookConfig[] {
    return this.hooks;
  }

  /**
   * Clear all hooks.
   */
  clear(): void {
    this.hooks = [];
  }

  // ── Private ─────────────────────────────────────────────────────────

  private executeHook(
    config: HookConfig,
    context: HookContext,
  ): Promise<HookExecutionResult> {
    return new Promise((resolve) => {
      const timeout = config.timeout ?? DEFAULT_TIMEOUT;
      const startTime = Date.now();

      // Pass context as environment variables
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        MIMI_HOOK_EVENT: context.event,
        MIMI_SESSION_ID: context.sessionId,
        MIMI_WORKING_DIR: context.workingDirectory,
      };

      if (context.toolName) {
        env['MIMI_TOOL_NAME'] = context.toolName;
      }
      if (context.toolInput) {
        env['MIMI_TOOL_INPUT'] = context.toolInput;
      }
      if (context.toolOutput) {
        env['MIMI_TOOL_OUTPUT'] = context.toolOutput;
      }

      const child = execFile(
        'bash',
        ['-c', config.command],
        {
          env,
          cwd: context.workingDirectory,
          timeout,
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          const durationMs = Date.now() - startTime;
          const exitCode = error ? (error as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0;

          // Parse hook result from stdout
          const result = this.parseHookOutput(stdout, exitCode as number);

          resolve({
            config,
            result,
            durationMs,
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode: typeof exitCode === 'number' ? exitCode : null,
          });
        },
      );

      // Safety: ensure we resolve even if child hangs
      child.on('error', () => {
        resolve({
          config,
          result: { action: 'continue' },
          durationMs: Date.now() - startTime,
          stdout: '',
          stderr: 'Hook process error',
          exitCode: null,
        });
      });
    });
  }

  /**
   * Parse hook output to determine action.
   *
   * Hook exit codes:
   *   0 = continue
   *   2 = block (tool should not execute)
   *   Other = continue (hook error doesn't block)
   *
   * Stdout can contain JSON for modify/block with data.
   */
  private parseHookOutput(stdout: string, exitCode: number): HookResult {
    // Exit code 2 = block
    if (exitCode === 2) {
      return {
        action: 'block',
        message: stdout.trim() || 'Blocked by hook',
      };
    }

    // Try to parse JSON from stdout for modify action
    if (stdout.trim()) {
      try {
        const parsed = JSON.parse(stdout.trim()) as {
          action?: string;
          modifiedInput?: unknown;
          injectedResult?: unknown;
          message?: string;
        };
        if (parsed.action === 'modify' && parsed.modifiedInput) {
          return {
            action: 'modify',
            modifiedInput: parsed.modifiedInput,
          };
        }
        if (parsed.action === 'block') {
          return {
            action: 'block',
            message: parsed.message ?? 'Blocked by hook',
          };
        }
      } catch {
        // Not JSON — that's fine, continue
      }
    }

    return { action: 'continue' };
  }
}
