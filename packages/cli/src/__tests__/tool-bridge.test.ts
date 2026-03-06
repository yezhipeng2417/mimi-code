/**
 * Tests for the ToolBridge adapter.
 *
 * Verifies that the bridge correctly maps between
 * AgentLoop's ToolExecutor interface and @mimi/tools.
 */

import { describe, it, expect, vi } from 'vitest';
import { ToolBridge } from '../tool-bridge.js';
import type { ToolResult, EventBusLike, ResourceManagerLike } from '@mimi/core';

// ── Mock Factories ───────────────────────────────────────────────────

function createMockRegistry(tools: Record<string, unknown> = {}) {
  return {
    getTool: vi.fn(async (name: string) => tools[name] ?? null),
    registerTool: vi.fn(),
    listTools: vi.fn(async () => Object.keys(tools)),
  };
}

function createMockExecutor(result?: ToolResult) {
  return {
    execute: vi.fn(async () => result ?? {
      content: [{ type: 'text' as const, text: 'ok' }],
    }),
  };
}

function createMockPermissionEngine(decision: 'allow' | 'deny' | 'ask' = 'allow') {
  return {
    check: vi.fn(async () => ({
      decision,
      ...(decision === 'allow' ? { source: 'rule' as const } : {}),
      ...(decision === 'deny' ? { reason: 'denied by policy' } : {}),
    })),
    addRule: vi.fn(),
    removeRule: vi.fn(),
  };
}

function createMockEventBus(): EventBusLike {
  return { emit: vi.fn() };
}

function createMockResourceManager(): ResourceManagerLike {
  return {
    trackTempFile: vi.fn((p: string) => p),
    onCleanup: vi.fn(),
  };
}

function createBridge(overrides: {
  tools?: Record<string, unknown>;
  result?: ToolResult;
  decision?: 'allow' | 'deny' | 'ask';
} = {}) {
  const registry = createMockRegistry(overrides.tools ?? { Bash: { name: 'Bash' } });
  const executor = createMockExecutor(overrides.result);
  const permissionEngine = createMockPermissionEngine(overrides.decision);

  const bridge = new ToolBridge({
    registry,
    executor,
    permissionEngine,
    eventBus: createMockEventBus(),
    resourceManager: createMockResourceManager(),
    workingDirectory: '/tmp/test',
    sessionId: 'test-session',
  });

  return { bridge, registry, executor, permissionEngine };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ToolBridge', () => {
  describe('execute', () => {
    it('executes a known tool and returns the result', async () => {
      const expectedResult: ToolResult = {
        content: [{ type: 'text', text: 'command output' }],
      };
      const { bridge, executor } = createBridge({
        tools: { Bash: { name: 'Bash' } },
        result: expectedResult,
      });

      const result = await bridge.execute('Bash', { command: 'ls' }, AbortSignal.timeout(5000));

      expect(result).toEqual(expectedResult);
      expect(executor.execute).toHaveBeenCalledOnce();
    });

    it('returns error for unknown tools', async () => {
      const { bridge } = createBridge({ tools: {} });

      const result = await bridge.execute('NonexistentTool', {}, AbortSignal.timeout(5000));

      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual(
        expect.objectContaining({ text: expect.stringContaining('Unknown tool') }),
      );
    });

    it('passes correct context to the executor', async () => {
      const { bridge, executor } = createBridge({
        tools: { Read: { name: 'Read' } },
      });

      await bridge.execute('Read', { file_path: '/test' }, AbortSignal.timeout(5000));

      const callArgs = executor.execute.mock.calls[0]!;
      // First arg: tool definition
      expect(callArgs[0]).toEqual({ name: 'Read' });
      // Second arg: input
      expect(callArgs[1]).toEqual({ file_path: '/test' });
      // Third arg: context object
      expect(callArgs[2]).toEqual(expect.objectContaining({
        sessionId: 'test-session',
        workingDirectory: '/tmp/test',
      }));
    });

    it('propagates error results from the executor', async () => {
      const errorResult: ToolResult = {
        content: [{ type: 'text', text: 'Permission denied' }],
        isError: true,
      };
      const { bridge } = createBridge({
        tools: { Write: { name: 'Write' } },
        result: errorResult,
      });

      const result = await bridge.execute('Write', {}, AbortSignal.timeout(5000));

      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual(
        expect.objectContaining({ text: 'Permission denied' }),
      );
    });
  });

  describe('hasPermission', () => {
    it('returns allow when permission engine allows', async () => {
      const { bridge } = createBridge({ decision: 'allow' });

      const result = await bridge.hasPermission('Bash', { command: 'ls' });

      expect(result.decision).toBe('allow');
    });

    it('returns deny when permission engine denies', async () => {
      const { bridge } = createBridge({ decision: 'deny' });

      const result = await bridge.hasPermission('Write', { file_path: '/etc/passwd' });

      expect(result.decision).toBe('deny');
    });

    it('returns ask when permission engine requires user confirmation', async () => {
      const { bridge } = createBridge({ decision: 'ask' });

      const result = await bridge.hasPermission('Bash', { command: 'rm -rf /' });

      expect(result.decision).toBe('ask');
    });

    it('passes tool name and input to the permission engine', async () => {
      const { bridge, permissionEngine } = createBridge();

      await bridge.hasPermission('Bash', { command: 'echo hi' });

      expect(permissionEngine.check).toHaveBeenCalledWith('Bash', { command: 'echo hi' });
    });
  });
});
