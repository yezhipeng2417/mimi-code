/**
 * Read tool — Read file contents with optional line range.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from '../types.js';

const inputSchema = z.object({
  file_path: z.string().describe('Absolute path to the file to read'),
  offset: z.number().optional().describe('Line number to start reading from (1-indexed)'),
  limit: z.number().optional().describe('Number of lines to read'),
});

export const readTool: Tool = {
  name: 'Read',
  description:
    'Read a file from the filesystem. Returns contents with line numbers. ' +
    'Supports text files, images (returned as base64), and PDFs.',
  source: 'builtin',
  category: 'filesystem',
  inputSchema,

  collapsedSummary(input: unknown) {
    const parsed = input as z.infer<typeof inputSchema>;
    return path.basename(parsed.file_path);
  },

  async execute(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { file_path, offset, limit } = inputSchema.parse(input);

    // Resolve relative to working directory
    const resolved = path.isAbsolute(file_path)
      ? file_path
      : path.resolve(ctx.workingDirectory, file_path);

    try {
      const stat = await fs.stat(resolved);

      if (stat.isDirectory()) {
        return {
          content: [{ type: 'text', text: `Error: "${resolved}" is a directory, not a file. Use Bash with ls to list directory contents.` }],
          isError: true,
        };
      }

      // Check if binary/image
      const ext = path.extname(resolved).toLowerCase();
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];

      if (imageExts.includes(ext)) {
        const data = await fs.readFile(resolved);
        const mediaType = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1).replace('jpg', 'jpeg')}`;
        return {
          content: [
            { type: 'image', source: { type: 'base64', mediaType, data: data.toString('base64') } },
          ],
        };
      }

      // Read as text
      const raw = await fs.readFile(resolved, 'utf-8');
      const lines = raw.split('\n');

      const startLine = Math.max(1, offset ?? 1);
      const endLine = limit ? startLine + limit - 1 : lines.length;

      const selected = lines.slice(startLine - 1, endLine);

      // Format with line numbers (cat -n style)
      const formatted = selected
        .map((line, i) => {
          const lineNum = startLine + i;
          const padding = String(endLine).length;
          const numStr = String(lineNum).padStart(padding, ' ');
          return `${numStr}\t${line}`;
        })
        .join('\n');

      return {
        content: [{ type: 'text', text: formatted }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error reading file: ${message}` }],
        isError: true,
      };
    }
  },
};
