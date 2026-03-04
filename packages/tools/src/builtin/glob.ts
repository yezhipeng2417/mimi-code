/**
 * Glob tool — Fast file pattern matching.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from '../types.js';

const inputSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files (e.g., "**/*.ts")'),
  path: z.string().optional().describe('Directory to search in (defaults to working directory)'),
});

/**
 * Simple glob matching using recursive directory traversal.
 * For production, consider using a native glob library.
 */
async function globMatch(
  baseDir: string,
  pattern: string,
  signal: AbortSignal,
): Promise<string[]> {
  const results: string[] = [];

  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*')
    .replace(/\./g, '\\.');

  const regex = new RegExp(`^${regexStr}$`);

  async function walk(dir: string, relPath: string): Promise<void> {
    if (signal.aborted) return;

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // Skip unreadable directories
    }

    for (const entry of entries) {
      if (signal.aborted) return;

      // Skip node_modules, .git, dist
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
        continue;
      }

      const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), entryRelPath);
      } else if (regex.test(entryRelPath)) {
        results.push(path.join(baseDir, entryRelPath));
      }
    }
  }

  await walk(baseDir, '');

  // Sort by modification time (newest first)
  const withStats = await Promise.all(
    results.map(async (filePath) => {
      try {
        const stat = await fs.stat(filePath);
        return { filePath, mtime: stat.mtimeMs };
      } catch {
        return { filePath, mtime: 0 };
      }
    }),
  );

  withStats.sort((a, b) => b.mtime - a.mtime);
  return withStats.map((s) => s.filePath);
}

export const globTool: Tool = {
  name: 'Glob',
  description:
    'Fast file pattern matching. Supports glob patterns like "**/*.js". ' +
    'Returns matching file paths sorted by modification time.',
  source: 'builtin',
  category: 'filesystem',
  inputSchema,

  collapsedSummary(input: unknown) {
    const parsed = input as z.infer<typeof inputSchema>;
    return parsed.pattern;
  },

  async execute(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    const baseDir = parsed.path
      ? path.isAbsolute(parsed.path)
        ? parsed.path
        : path.resolve(ctx.workingDirectory, parsed.path)
      : ctx.workingDirectory;

    try {
      const matches = await globMatch(baseDir, parsed.pattern, ctx.abortSignal);

      if (matches.length === 0) {
        return {
          content: [{ type: 'text', text: `No files matched pattern "${parsed.pattern}" in ${baseDir}` }],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: matches.join('\n'),
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Glob error: ${message}` }],
        isError: true,
      };
    }
  },
};
