/**
 * Tests for ToolExecutor — timeout, cancellation, validation, and error handling.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ToolExecutor } from '../executor.js';
import type { Tool } from '../types.js';
import type { ToolContext, ToolResult, EventBusLike, ResourceManagerLike } from '@mimi/core';

// ── Helpers ──────────────────────────────────────────────────────────

function createTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'TestTool',
    description: 'A test tool',
    source: 'builtin',
    inputSchema: z.object({ value: z.string() }),
    execute: vi.fn(async () => ({
      content: [{ type: 'text' as const, text: 'ok' }],
    })),
    ...overrides,
  };
}

function createCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    sessionId: 'test-session',
    workingDirectory: '/tmp/test',
    abortSignal: new AbortController().signal,
    permissions: { check: vi.fn(async () => ({ decision: 'allow' as const, source: 'rule' as const })) },
    eventBus: { emit: vi.fn() },
    resourceManager: {
      trackTempFile: vi.fn((p: string) => p),
      onCleanup: vi.fn(),
    },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ToolExecutor', () => {
  it('executes a tool with valid input and returns the result', async () => {
    const executor = new ToolExecutor();
    const tool = createTool();
    const ctx = createCtx();

    const result = await executor.execute(tool, { value: 'hello' }, ctx);

    expect(result.content[0]).toEqual({ type: 'text', text: 'ok' });
    expect(result.isError).toBeUndefined();
    expect(tool.execute).toHaveBeenCalledOnce();
  });

  it('validates input against zod schema and returns error for invalid input', async () => {
    const executor = new ToolExecutor();
    const tool = createTool();
    const ctx = createCtx();

    const result = await executor.execute(tool, { value: 123 }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual(
      expect.objectContaining({ text: expect.stringContaining('Invalid input') }),
    );
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('returns error for missing required fields', async () => {
    const executor = new ToolExecutor();
    const tool = createTool();
    const ctx = createCtx();

    const result = await executor.execute(tool, {}, ctx);

    expect(result.isError).toBe(true);
  });

  it('returns cancellation message when parent abort signal is already aborted', async () => {
    const executor = new ToolExecutor();
    const tool = createTool();
    const controller = new AbortController();
    controller.abort();
    const ctx = createCtx({ abortSignal: controller.signal });

    const result = await executor.execute(tool, { value: 'test' }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual(
      expect.objectContaining({ text: expect.stringContaining('cancelled') }),
    );
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('times out slow tools', async () => {
    const executor = new ToolExecutor({ defaultTimeout: 50 });
    const tool = createTool({
      execute: vi.fn(async (_input: unknown, ctx: ToolContext) => {
        // Simulate an abort-aware tool
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 5000);
          ctx.abortSignal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('aborted'));
          }, { once: true });
        });
        return { content: [{ type: 'text' as const, text: 'late' }] };
      }),
    });
    const ctx = createCtx();

    const result = await executor.execute(tool, { value: 'test' }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual(
      expect.objectContaining({ text: expect.stringContaining('timed out') }),
    );
  });

  it('catches errors thrown by tool.execute', async () => {
    const eventBus: EventBusLike = { emit: vi.fn() };
    const executor = new ToolExecutor({ eventBus });
    const tool = createTool({
      execute: vi.fn(async () => { throw new Error('boom'); }),
    });
    const ctx = createCtx();

    const result = await executor.execute(tool, { value: 'test' }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual(
      expect.objectContaining({ text: expect.stringContaining('boom') }),
    );
    expect(eventBus.emit).toHaveBeenCalledWith('tool:error', expect.objectContaining({
      toolName: 'TestTool',
    }));
  });

  it('emits tool:end event on successful execution', async () => {
    const eventBus: EventBusLike = { emit: vi.fn() };
    const executor = new ToolExecutor({ eventBus });
    const tool = createTool();
    const ctx = createCtx();

    await executor.execute(tool, { value: 'test' }, ctx);

    expect(eventBus.emit).toHaveBeenCalledWith('tool:end', expect.objectContaining({
      toolName: 'TestTool',
    }));
  });

  it('respects custom timeout parameter', async () => {
    const executor = new ToolExecutor({ defaultTimeout: 10000 });
    const tool = createTool({
      execute: vi.fn(async (_input: unknown, ctx: ToolContext) => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 5000);
          ctx.abortSignal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('aborted'));
          }, { once: true });
        });
        return { content: [{ type: 'text' as const, text: 'late' }] };
      }),
    });
    const ctx = createCtx();

    // Use a very short custom timeout (overrides the 10s default)
    const result = await executor.execute(tool, { value: 'test' }, ctx, 50);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual(
      expect.objectContaining({ text: expect.stringContaining('timed out') }),
    );
  });

  it('passes validated input to tool.execute', async () => {
    const executor = new ToolExecutor();
    const executeFn = vi.fn(async () => ({
      content: [{ type: 'text' as const, text: 'ok' }],
    }));
    const tool = createTool({ execute: executeFn });
    const ctx = createCtx();

    await executor.execute(tool, { value: 'hello' }, ctx);

    // First arg should be the validated input
    expect(executeFn.mock.calls[0]![0]).toEqual({ value: 'hello' });
  });
});
