/**
 * Agent loop integration tests with mock provider.
 */

import { describe, it, expect, vi } from 'vitest';
import { AgentLoop } from '../agent-loop.js';
import { PromptAssembler } from '../prompt-assembler.js';
import { EventBus } from '../event-bus.js';
import { ResourceManager } from '../resource-manager.js';
import { SessionStore } from '../session-store.js';
import type { LLMProvider, StreamEvent, MessageParams } from '../types.js';

// ── Mock Provider ─────────────────────────────────────────────────────

function createMockProvider(responses: StreamEvent[][]): LLMProvider {
  let callIndex = 0;
  return {
    name: 'mock',

    async *createMessage(_params: MessageParams): AsyncIterable<StreamEvent> {
      const events = responses[callIndex] ?? responses[responses.length - 1]!;
      callIndex++;
      for (const event of events) {
        yield event;
      }
    },

    async countTokens(): Promise<number> {
      return 1000; // Low enough to not trigger compaction
    },
  };
}

function textResponse(text: string): StreamEvent[] {
  return [
    { type: 'message_start', messageId: 'msg-1' },
    { type: 'content_block_start', index: 0, contentBlock: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    {
      type: 'message_delta',
      stopReason: 'end_turn',
      usage: { inputTokens: 100, outputTokens: 50 },
    },
    { type: 'message_stop' },
  ];
}

function toolUseResponse(toolName: string, toolId: string, input: Record<string, unknown>): StreamEvent[] {
  return [
    { type: 'message_start', messageId: 'msg-tool' },
    {
      type: 'content_block_start',
      index: 0,
      contentBlock: {
        type: 'tool_use',
        id: toolId,
        name: toolName,
        input: {},
      },
    },
    {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'input_json_delta', partialJson: JSON.stringify(input) },
    },
    { type: 'content_block_stop', index: 0 },
    {
      type: 'message_delta',
      stopReason: 'tool_use',
      usage: { inputTokens: 100, outputTokens: 50 },
    },
    { type: 'message_stop' },
  ];
}

// ── Setup Helpers ─────────────────────────────────────────────────────

function createTestAssembler() {
  const assembler = new PromptAssembler({
    coreSystemPrompt: 'You are a test assistant.',
    defaultModel: 'mock-model',
    defaultMaxTokens: 4096,
  });
  assembler.freezeTools([]);
  return assembler;
}

function createTestLoop(
  provider: LLMProvider,
  options?: {
    toolExecutor?: AgentLoop extends { config: infer C } ? C extends { toolExecutor: infer T } ? T : never : never;
    permissionPrompt?: AgentLoop extends { config: infer C } ? C extends { permissionPrompt: infer T } ? T : never : never;
  },
) {
  const eventBus = new EventBus();
  const resourceManager = new ResourceManager();
  const sessionStore = SessionStore.forProject('/tmp/test-agent-loop');
  const session = sessionStore.createSession('/test', 'mock-model');

  return new AgentLoop({
    provider,
    assembler: createTestAssembler(),
    sessionStore,
    eventBus,
    resourceManager,
    toolExecutor: options?.toolExecutor ?? {
      execute: async () => ({ content: [{ type: 'text', text: 'tool result' }] }),
      hasPermission: async () => ({ decision: 'allow' as const }),
    },
    permissionPrompt: options?.permissionPrompt ?? {
      ask: async () => ({ allowed: true, persist: false }),
    },
    sessionId: session.id,
    maxTurns: 10,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('AgentLoop', () => {
  it('should process a simple text response', async () => {
    const provider = createMockProvider([textResponse('Hello!')]);
    const loop = createTestLoop(provider);

    const messages = await loop.run('Hi there');

    expect(messages.length).toBe(1);
    expect(messages[0]!.role).toBe('assistant');
    expect(messages[0]!.content[0]!.type).toBe('text');
    expect((messages[0]!.content[0] as { text: string }).text).toBe('Hello!');
    expect(loop.currentState).toBe('IDLE');
  });

  it('should handle tool use and loop back', async () => {
    const provider = createMockProvider([
      // Turn 1: tool call
      toolUseResponse('ReadFile', 'tool-1', { path: '/test.txt' }),
      // Turn 2: final response
      textResponse('File content is: hello'),
    ]);

    const executeSpy = vi.fn(async () => ({
      content: [{ type: 'text' as const, text: 'hello' }],
    }));

    const loop = createTestLoop(provider, {
      toolExecutor: {
        execute: executeSpy,
        hasPermission: async () => ({ decision: 'allow' as const }),
      },
    });

    const messages = await loop.run('Read /test.txt');

    // Should have: assistant (tool_use) + user (tool_result) + assistant (text)
    expect(messages.length).toBe(3);
    expect(executeSpy).toHaveBeenCalledOnce();
    expect(executeSpy).toHaveBeenCalledWith('ReadFile', { path: '/test.txt' }, expect.any(AbortSignal));
  });

  it('should deny tool use when permission is denied', async () => {
    const provider = createMockProvider([
      toolUseResponse('Bash', 'tool-deny', { command: 'rm -rf /' }),
      textResponse('I could not run that command.'),
    ]);

    const loop = createTestLoop(provider, {
      toolExecutor: {
        execute: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
        hasPermission: async () => ({ decision: 'ask' as const }),
      },
      permissionPrompt: {
        ask: async () => ({ allowed: false, persist: false }),
      },
    });

    const messages = await loop.run('Run a command');

    // Tool result should contain denial
    const toolResultMsg = messages.find((m) => m.role === 'user');
    expect(toolResultMsg).toBeDefined();
    const resultBlock = toolResultMsg!.content[0]!;
    expect(resultBlock.type).toBe('tool_result');
    expect((resultBlock as { isError: boolean }).isError).toBe(true);
  });

  it('should respect maxTurns limit', async () => {
    // Provider always returns tool calls — infinite loop scenario
    const provider = createMockProvider([
      toolUseResponse('ReadFile', 'tool-loop', { path: '/x' }),
    ]);

    const loop = createTestLoop(provider);

    const messages = await loop.run('loop forever');

    // Should stop at maxTurns (10) without throwing
    expect(loop.currentTurnCount).toBeLessThanOrEqual(10);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('should support cancellation via cancel()', () => {
    const provider = createMockProvider([textResponse('Hello')]);
    const loop = createTestLoop(provider);

    // Cancel before running
    loop.cancel();

    expect(loop.currentState).toBe('CANCELLED');
  });

  it('should load messages for session resumption', async () => {
    const provider = createMockProvider([textResponse('Continuing...')]);
    const loop = createTestLoop(provider);

    // Pre-load messages
    loop.loadMessages([
      { role: 'user', content: [{ type: 'text', text: 'Previous message' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Previous response' }] },
    ]);

    const newMessages = await loop.run('Continue please');

    // Should have all messages (2 loaded + 1 new user + 1 new assistant)
    expect(loop.allMessages.length).toBe(4);
    // Only new messages returned
    expect(newMessages.length).toBe(1);
  });
});
