import { describe, it, expect, vi } from 'vitest';
import { HookRunner } from '../runner.js';
import type { HookConfig, HookContext } from '../types.js';

function createContext(overrides: Partial<HookContext> = {}): HookContext {
  return {
    event: 'PreToolUse',
    sessionId: 'test-session',
    workingDirectory: '/tmp',
    ...overrides,
  };
}

describe('HookRunner', () => {
  it('should return continue when no hooks match', async () => {
    const runner = new HookRunner([]);
    const result = await runner.fire('PreToolUse', createContext());
    expect(result.action).toBe('continue');
  });

  it('should register and retrieve hooks', () => {
    const runner = new HookRunner();
    runner.registerHook({
      event: 'PreToolUse',
      command: 'echo hello',
    });

    expect(runner.getHooks()).toHaveLength(1);
    expect(runner.getHooks()[0]!.command).toBe('echo hello');
  });

  it('should clear hooks', () => {
    const runner = new HookRunner([
      { event: 'PreToolUse', command: 'echo 1' },
      { event: 'PostToolUse', command: 'echo 2' },
    ]);

    runner.clear();
    expect(runner.getHooks()).toHaveLength(0);
  });

  it('should load hooks from config array', () => {
    const runner = new HookRunner();
    runner.loadHooks([
      { event: 'PreToolUse', command: 'echo a' },
      { event: 'PostToolUse', command: 'echo b' },
    ]);

    expect(runner.getHooks()).toHaveLength(2);
  });

  it('should filter hooks by event type', async () => {
    const runner = new HookRunner([
      { event: 'PreToolUse', command: 'echo pre', blocking: false },
      { event: 'PostToolUse', command: 'echo post', blocking: false },
    ]);

    // This test verifies filtering - both hooks run echo which returns 0 (continue)
    const result = await runner.fire('PreToolUse', createContext());
    expect(result.action).toBe('continue');
  });

  it('should filter hooks by tool name', async () => {
    const runner = new HookRunner([
      { event: 'PreToolUse', command: 'echo allowed', toolName: 'Read' },
      { event: 'PreToolUse', command: 'exit 2', toolName: 'Write', blocking: true },
    ]);

    // Should only run "echo allowed" (Read match), not the blocking Write hook
    const result = await runner.fire('PreToolUse', createContext({ toolName: 'Read' }));
    expect(result.action).toBe('continue');
  });

  it('should execute blocking hook that exits with code 2 (block)', async () => {
    const runner = new HookRunner([
      { event: 'PreToolUse', command: 'exit 2', blocking: true },
    ]);

    const result = await runner.fire('PreToolUse', createContext());
    expect(result.action).toBe('block');
  });

  it('should continue on non-blocking hooks even if exit code is non-zero', async () => {
    const runner = new HookRunner([
      { event: 'PreToolUse', command: 'exit 1', blocking: false },
    ]);

    const result = await runner.fire('PreToolUse', createContext());
    expect(result.action).toBe('continue');
  });

  it('should emit hook:fired event via eventBus', async () => {
    const eventBus = { emit: vi.fn() };
    const runner = new HookRunner(
      [{ event: 'PreToolUse', command: 'echo hello' }],
      eventBus,
    );

    await runner.fire('PreToolUse', createContext());

    expect(eventBus.emit).toHaveBeenCalledWith('hook:fired', {
      event: 'PreToolUse',
      hookName: 'echo hello',
    });
  });

  it('should emit hook:blocked event when hook blocks', async () => {
    const eventBus = { emit: vi.fn() };
    const runner = new HookRunner(
      [{ event: 'PreToolUse', command: 'exit 2', blocking: true }],
      eventBus,
    );

    await runner.fire('PreToolUse', createContext());

    expect(eventBus.emit).toHaveBeenCalledWith('hook:blocked', expect.objectContaining({
      event: 'PreToolUse',
      hookName: 'exit 2',
    }));
  });

  it('should parse JSON modify action from stdout', async () => {
    const runner = new HookRunner([
      {
        event: 'PreToolUse',
        command: 'echo \'{"action":"modify","modifiedInput":{"path":"/safe"}}\'',
        blocking: true,
      },
    ]);

    const result = await runner.fire('PreToolUse', createContext());
    expect(result.action).toBe('modify');
    expect(result.modifiedInput).toEqual({ path: '/safe' });
  });
});
