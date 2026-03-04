/**
 * Edit tool — Exact string replacement in files.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from '../types.js';

const inputSchema = z.object({
  file_path: z.string().describe('Absolute path to the file to modify'),
  old_string: z.string().describe('The exact text to replace'),
  new_string: z.string().describe('The replacement text'),
  replace_all: z.boolean().optional().default(false).describe('Replace all occurrences'),
});

export const editTool: Tool = {
  name: 'Edit',
  description:
    'Perform exact string replacements in files. The old_string must match exactly ' +
    '(including whitespace and indentation). Use replace_all to change every instance.',
  source: 'builtin',
  category: 'filesystem',
  inputSchema,

  collapsedSummary(input: unknown) {
    const parsed = input as z.infer<typeof inputSchema>;
    return path.basename(parsed.file_path);
  },

  async execute(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { file_path, old_string, new_string, replace_all } = inputSchema.parse(input);

    const resolved = path.isAbsolute(file_path)
      ? file_path
      : path.resolve(ctx.workingDirectory, file_path);

    try {
      const content = await fs.readFile(resolved, 'utf-8');

      if (old_string === new_string) {
        return {
          content: [{ type: 'text', text: 'old_string and new_string are identical. No changes made.' }],
          isError: true,
        };
      }

      if (!content.includes(old_string)) {
        return {
          content: [{ type: 'text', text: `Could not find the string to replace in ${resolved}. Make sure old_string matches exactly.` }],
          isError: true,
        };
      }

      // Check uniqueness if not replace_all
      if (!replace_all) {
        const count = content.split(old_string).length - 1;
        if (count > 1) {
          return {
            content: [
              {
                type: 'text',
                text: `Found ${count} occurrences of old_string. Use replace_all: true to replace all, or provide more context to make it unique.`,
              },
            ],
            isError: true,
          };
        }
      }

      const updated = replace_all
        ? content.split(old_string).join(new_string)
        : content.replace(old_string, new_string);

      await fs.writeFile(resolved, updated, 'utf-8');

      const replacements = replace_all
        ? content.split(old_string).length - 1
        : 1;

      return {
        content: [
          {
            type: 'text',
            text: `Successfully edited ${resolved} (${replacements} replacement${replacements > 1 ? 's' : ''})`,
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error editing file: ${message}` }],
        isError: true,
      };
    }
  },
};
