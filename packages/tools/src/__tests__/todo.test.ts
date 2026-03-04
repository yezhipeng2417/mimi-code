import { describe, it, expect } from 'vitest';
import { todoWriteTool, getTodoList } from '../builtin/todo.js';
import type { ToolContext } from '@mimi/core';

function makeCtx(sessionId: string): ToolContext {
  return {
    sessionId,
    workingDirectory: '/tmp',
    abortSignal: new AbortController().signal,
    permissions: {
      check: async () => ({ decision: 'allow' as const, source: 'rule' as const }),
    },
    eventBus: { emit: () => {} } as any,
    resourceManager: {} as any,
  };
}

describe('TodoWriteTool', () => {
  it('should store and format a todo list', async () => {
    const result = await todoWriteTool.execute(
      {
        todos: [
          { id: '1', task: 'Read codebase', status: 'completed' },
          { id: '2', task: 'Write tests', status: 'in_progress' },
          { id: '3', task: 'Deploy', status: 'pending' },
        ],
      },
      makeCtx('session-todo-1'),
    );

    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: 'text'; text: string }).text;
    expect(text).toContain('1/3 done');
    expect(text).toContain('1 in progress');
    expect(text).toContain('✓');
    expect(text).toContain('▸');
    expect(text).toContain('○');
  });

  it('should isolate todo lists per session', async () => {
    await todoWriteTool.execute(
      { todos: [{ id: '1', task: 'Task A', status: 'pending' }] },
      makeCtx('session-a'),
    );
    await todoWriteTool.execute(
      { todos: [{ id: '1', task: 'Task B', status: 'completed' }] },
      makeCtx('session-b'),
    );

    const listA = getTodoList('session-a');
    const listB = getTodoList('session-b');

    expect(listA).toHaveLength(1);
    expect(listA[0]?.task).toBe('Task A');
    expect(listB[0]?.task).toBe('Task B');
  });

  it('should replace the entire list on each call', async () => {
    const ctx = makeCtx('session-replace');
    await todoWriteTool.execute(
      { todos: [{ id: '1', task: 'First', status: 'pending' }] },
      ctx,
    );
    await todoWriteTool.execute(
      { todos: [{ id: '2', task: 'Second', status: 'pending' }] },
      ctx,
    );

    const list = getTodoList('session-replace');
    expect(list).toHaveLength(1);
    expect(list[0]?.task).toBe('Second');
  });

  it('should provide a collapsed summary', () => {
    const summary = todoWriteTool.collapsedSummary?.({
      todos: [
        { id: '1', task: 'A', status: 'completed' },
        { id: '2', task: 'B', status: 'pending' },
      ],
    });
    expect(summary).toBe('1/2 tasks');
  });
});
