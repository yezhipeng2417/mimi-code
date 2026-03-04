/**
 * TodoWrite tool — Manage task lists during sessions.
 *
 * Provides a simple in-memory task list for tracking progress
 * through multi-step operations.
 */

import { z } from 'zod';
import type { ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from '../types.js';

const todoSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed']).describe('Status of the task'),
});

const inputSchema = z.object({
  todos: z.array(
    z.object({
      id: z.string().describe('Unique identifier for the todo item'),
      task: z.string().describe('Description of the task'),
      status: todoSchema.shape.status,
    }),
  ).describe('Complete list of todo items. Replaces the entire list each time.'),
});

// In-memory store keyed by sessionId
const todoStores = new Map<string, Array<{ id: string; task: string; status: string }>>();

export const todoWriteTool: Tool = {
  name: 'TodoWrite',
  description:
    'Write and manage a task list for tracking multi-step operations. ' +
    'Provide the complete list of todo items each time (replaces previous list). ' +
    'Use status: pending, in_progress, or completed.',
  source: 'builtin',
  category: 'workflow',
  inputSchema,

  collapsedSummary(input: unknown) {
    const parsed = input as z.infer<typeof inputSchema>;
    const total = parsed.todos.length;
    const done = parsed.todos.filter((t) => t.status === 'completed').length;
    return `${done}/${total} tasks`;
  },

  async execute(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);

    // Store the todo list for this session
    todoStores.set(ctx.sessionId, [...parsed.todos]);

    // Format output
    const lines = parsed.todos.map((t) => {
      const icon = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '▸' : '○';
      return `${icon} [${t.id}] ${t.task}`;
    });

    const total = parsed.todos.length;
    const completed = parsed.todos.filter((t) => t.status === 'completed').length;
    const inProgress = parsed.todos.filter((t) => t.status === 'in_progress').length;

    return {
      content: [
        {
          type: 'text',
          text: `Todo list updated (${completed}/${total} done, ${inProgress} in progress):\n${lines.join('\n')}`,
        },
      ],
    };
  },
};

/**
 * Get the current todo list for a session (used by other tools/UI).
 */
export function getTodoList(sessionId: string): Array<{ id: string; task: string; status: string }> {
  return todoStores.get(sessionId) ?? [];
}
