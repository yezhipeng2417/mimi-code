/**
 * Grep tool — Content search powered by ripgrep (with fallback).
 */

import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { z } from 'zod';
import type { ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from '../types.js';

const inputSchema = z.object({
  pattern: z.string().describe('Regex pattern to search for'),
  path: z.string().optional().describe('File or directory to search in'),
  glob: z.string().optional().describe('Glob pattern to filter files (e.g., "*.ts")'),
  type: z.string().optional().describe('File type to search (e.g., "js", "py")'),
  output_mode: z.enum(['content', 'files_with_matches', 'count']).optional().default('files_with_matches'),
  context: z.number().optional().describe('Lines of context around matches'),
});

function runRipgrep(args: string[], cwd: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile('rg', args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, _stderr) => {
      if (signal.aborted) {
        reject(new Error('Search cancelled'));
        return;
      }
      // rg exits with 1 when no matches found — that's ok
      if (error && (error as NodeJS.ErrnoException).code !== 'ENOENT' && error.killed !== true) {
        if (stdout) {
          resolve(stdout);
        } else {
          resolve(''); // No matches
        }
      } else {
        resolve(stdout || '');
      }
    });

    signal.addEventListener('abort', () => child.kill(), { once: true });
  });
}

function runGrepFallback(pattern: string, searchPath: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-rn', '--include=*', pattern, searchPath];
    const child = execFile('grep', args, { maxBuffer: 10 * 1024 * 1024 }, (_error, stdout) => {
      if (signal.aborted) {
        reject(new Error('Search cancelled'));
        return;
      }
      resolve(stdout || '');
    });

    signal.addEventListener('abort', () => child.kill(), { once: true });
  });
}

export const grepTool: Tool = {
  name: 'Grep',
  description:
    'Search file contents using regex patterns. Built on ripgrep for speed. ' +
    'Supports glob filtering, file type filtering, and context lines.',
  source: 'builtin',
  category: 'search',
  inputSchema,

  collapsedSummary(input: unknown) {
    const parsed = input as z.infer<typeof inputSchema>;
    return `/${parsed.pattern}/`;
  },

  async execute(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    const searchPath = parsed.path
      ? path.isAbsolute(parsed.path)
        ? parsed.path
        : path.resolve(ctx.workingDirectory, parsed.path)
      : ctx.workingDirectory;

    try {
      // Build ripgrep args
      const args: string[] = [];

      if (parsed.output_mode === 'files_with_matches') {
        args.push('-l');
      } else if (parsed.output_mode === 'count') {
        args.push('-c');
      } else {
        args.push('-n'); // line numbers
      }

      if (parsed.context && parsed.output_mode === 'content') {
        args.push('-C', String(parsed.context));
      }

      if (parsed.glob) {
        args.push('--glob', parsed.glob);
      }

      if (parsed.type) {
        args.push('--type', parsed.type);
      }

      args.push(parsed.pattern, searchPath);

      let output: string;
      try {
        output = await runRipgrep(args, ctx.workingDirectory, ctx.abortSignal);
      } catch {
        // Fallback to grep if rg not available
        output = await runGrepFallback(parsed.pattern, searchPath, ctx.abortSignal);
      }

      if (!output.trim()) {
        return {
          content: [{ type: 'text', text: `No matches found for pattern "${parsed.pattern}"` }],
        };
      }

      return {
        content: [{ type: 'text', text: output.trim() }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Grep error: ${message}` }],
        isError: true,
      };
    }
  },
};
