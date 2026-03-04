/**
 * Write tool — Write content to a file, creating directories as needed.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from '../types.js';

const inputSchema = z.object({
  file_path: z.string().describe('Absolute path to the file to write'),
  content: z.string().describe('The content to write to the file'),
});

export const writeTool: Tool = {
  name: 'Write',
  description:
    'Write content to a file. Creates the file if it does not exist. ' +
    'Creates parent directories as needed. Overwrites existing content.',
  source: 'builtin',
  category: 'filesystem',
  inputSchema,

  collapsedSummary(input: unknown) {
    const parsed = input as z.infer<typeof inputSchema>;
    return path.basename(parsed.file_path);
  },

  async execute(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { file_path, content } = inputSchema.parse(input);

    const resolved = path.isAbsolute(file_path)
      ? file_path
      : path.resolve(ctx.workingDirectory, file_path);

    try {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(resolved), { recursive: true });

      await fs.writeFile(resolved, content, 'utf-8');

      const stat = await fs.stat(resolved);
      const lineCount = content.split('\n').length;

      return {
        content: [
          {
            type: 'text',
            text: `Successfully wrote ${lineCount} lines (${stat.size} bytes) to ${resolved}`,
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error writing file: ${message}` }],
        isError: true,
      };
    }
  },
};
