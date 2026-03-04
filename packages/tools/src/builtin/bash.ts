/**
 * Bash tool — Execute shell commands with timeout and streaming output.
 */

import { spawn } from 'node:child_process';
import { z } from 'zod';
import type { ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from '../types.js';

const inputSchema = z.object({
  command: z.string().describe('The shell command to execute'),
  timeout: z.number().optional().describe('Timeout in milliseconds (default: 120000)'),
  description: z.string().optional().describe('Description of what this command does'),
});

const MAX_OUTPUT = 512 * 1024; // 512KB max output

export const bashTool: Tool = {
  name: 'Bash',
  description:
    'Execute a bash command and return its output. ' +
    'Commands run in the working directory. Timeout defaults to 120s.',
  source: 'builtin',
  category: 'system',
  inputSchema,

  collapsedSummary(input: unknown) {
    const parsed = input as z.infer<typeof inputSchema>;
    const cmd = parsed.command;
    return cmd.length > 40 ? `${cmd.slice(0, 37)}...` : cmd;
  },

  async execute(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);
    const timeout = parsed.timeout ?? 120_000;

    return new Promise<ToolResult>((resolve) => {
      const child = spawn('bash', ['-c', parsed.command], {
        cwd: ctx.workingDirectory,
        env: { ...process.env, TERM: 'dumb' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (stdout.length + chunk.length <= MAX_OUTPUT) {
          stdout += chunk;
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (stderr.length + chunk.length <= MAX_OUTPUT) {
          stderr += chunk;
        }
      });

      // Timeout
      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 5000);
      }, timeout);

      // Parent abort
      const onAbort = () => {
        killed = true;
        child.kill('SIGTERM');
      };
      ctx.abortSignal.addEventListener('abort', onAbort, { once: true });

      child.on('close', (code) => {
        clearTimeout(timer);
        ctx.abortSignal.removeEventListener('abort', onAbort);

        if (killed && !ctx.abortSignal.aborted) {
          resolve({
            content: [
              {
                type: 'text',
                text: `Command timed out after ${timeout}ms.\n\nPartial stdout:\n${stdout}\n\nPartial stderr:\n${stderr}`,
              },
            ],
            isError: true,
          });
          return;
        }

        let output = '';
        if (stdout) output += stdout;
        if (stderr) output += (output ? '\n\n' : '') + `stderr:\n${stderr}`;
        if (!output) output = '(no output)';
        if (code !== 0 && code !== null) {
          output += `\n\nExit code: ${code}`;
        }

        resolve({
          content: [{ type: 'text', text: output }],
          isError: code !== 0 && code !== null,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        ctx.abortSignal.removeEventListener('abort', onAbort);
        resolve({
          content: [{ type: 'text', text: `Command execution error: ${err.message}` }],
          isError: true,
        });
      });

      // Close stdin
      child.stdin?.end();
    });
  },
};
