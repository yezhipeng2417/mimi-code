/**
 * ToolExecutor — Handles tool execution with timeout, cancellation, and error handling.
 */

import type { EventBusLike, ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from './types.js';

export interface ExecutorOptions {
  /** Default timeout in ms (default: 120000) */
  defaultTimeout?: number;

  /** EventBus for error reporting */
  eventBus?: EventBusLike;
}

export class ToolExecutor {
  private defaultTimeout: number;
  private eventBus?: EventBusLike;

  constructor(options: ExecutorOptions = {}) {
    this.defaultTimeout = options.defaultTimeout ?? 120_000;
    this.eventBus = options.eventBus;
  }

  /**
   * Execute a tool with timeout and error handling.
   */
  async execute(
    tool: Tool,
    input: unknown,
    ctx: ToolContext,
    timeout?: number,
  ): Promise<ToolResult> {
    const effectiveTimeout = timeout ?? this.defaultTimeout;

    // Create a child AbortController that composes with parent
    const controller = new AbortController();
    const parentSignal = ctx.abortSignal;

    // If parent already aborted, abort immediately
    if (parentSignal.aborted) {
      return {
        content: [{ type: 'text', text: 'Tool execution cancelled.' }],
        isError: true,
      };
    }

    // Listen for parent abort
    const onParentAbort = () => controller.abort();
    parentSignal.addEventListener('abort', onParentAbort, { once: true });

    // Set timeout
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);

    // Create child context with our controller's signal
    const childCtx: ToolContext = {
      ...ctx,
      abortSignal: controller.signal,
    };

    const startTime = Date.now();

    try {
      // Validate input against schema
      const parseResult = tool.inputSchema.safeParse(input);
      if (!parseResult.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Invalid input for tool "${tool.name}": ${parseResult.error.message}`,
            },
          ],
          isError: true,
        };
      }

      // Execute the tool
      const result = await tool.execute(parseResult.data, childCtx);

      // Emit success event
      this.eventBus?.emit('tool:end', {
        toolName: tool.name,
        toolUseId: '',
        result,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if it's an abort/timeout
      if (controller.signal.aborted) {
        const isTimeout = !parentSignal.aborted;
        return {
          content: [
            {
              type: 'text',
              text: isTimeout
                ? `Tool "${tool.name}" timed out after ${effectiveTimeout}ms.`
                : `Tool "${tool.name}" was cancelled.`,
            },
          ],
          isError: true,
        };
      }

      // Emit error event
      this.eventBus?.emit('tool:error', {
        toolName: tool.name,
        error: err,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Tool "${tool.name}" error: ${err.message}`,
          },
        ],
        isError: true,
      };
    } finally {
      clearTimeout(timer);
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}
