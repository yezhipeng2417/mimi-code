/**
 * AskUserQuestion — Prompt the user for input during execution.
 */

import { z } from 'zod';
import type { ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from '../types.js';

const optionSchema = z.object({
  label: z.string().describe('Display text for this option'),
  description: z.string().optional().describe('Explanation of what this option means'),
});

const questionSchema = z.object({
  question: z.string().describe('The question to ask the user'),
  options: z.array(optionSchema).optional().describe('Available choices'),
});

const inputSchema = z.object({
  questions: z.array(questionSchema).min(1).max(4).describe('Questions to ask'),
});

/**
 * The AskUserQuestion tool requires a UI callback to present questions.
 * This factory creates the tool with the callback injected.
 */
export type AskUserCallback = (
  questions: Array<{ question: string; options?: Array<{ label: string; description?: string }> }>,
) => Promise<Record<string, string>>;

export function createAskUserTool(callback: AskUserCallback): Tool {
  return {
    name: 'AskUserQuestion',
    description:
      'Ask the user questions during execution. Use to gather preferences, ' +
      'clarify requirements, or get decisions on implementation choices.',
    source: 'builtin',
    category: 'interaction',
    inputSchema,

    async execute(input: unknown, _ctx: ToolContext): Promise<ToolResult> {
      const { questions } = inputSchema.parse(input);

      try {
        const answers = await callback(questions);

        const formatted = Object.entries(answers)
          .map(([q, a]) => `Q: ${q}\nA: ${a}`)
          .join('\n\n');

        return {
          content: [{ type: 'text', text: formatted }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Error getting user input: ${message}` }],
          isError: true,
        };
      }
    },
  };
}
