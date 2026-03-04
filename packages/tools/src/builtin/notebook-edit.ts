/**
 * NotebookEdit — Edit Jupyter notebook cells.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from '../types.js';

const inputSchema = z.object({
  notebook_path: z.string().describe('Absolute path to the .ipynb file'),
  cell_number: z.number().optional().describe('0-indexed cell number to edit'),
  new_source: z.string().describe('New source content for the cell'),
  cell_type: z.enum(['code', 'markdown']).optional().describe('Cell type'),
  edit_mode: z.enum(['replace', 'insert', 'delete']).optional().default('replace'),
});

interface NotebookCell {
  cell_type: string;
  source: string[];
  metadata: Record<string, unknown>;
  outputs?: unknown[];
  execution_count?: number | null;
}

interface Notebook {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

export const notebookEditTool: Tool = {
  name: 'NotebookEdit',
  description:
    'Edit Jupyter notebook (.ipynb) cells. Supports replacing, inserting, and deleting cells.',
  source: 'builtin',
  category: 'filesystem',
  inputSchema,

  collapsedSummary(input: unknown) {
    const parsed = input as z.infer<typeof inputSchema>;
    return path.basename(parsed.notebook_path);
  },

  async execute(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const parsed = inputSchema.parse(input);

    const resolved = path.isAbsolute(parsed.notebook_path)
      ? parsed.notebook_path
      : path.resolve(ctx.workingDirectory, parsed.notebook_path);

    try {
      const raw = await fs.readFile(resolved, 'utf-8');
      const notebook = JSON.parse(raw) as Notebook;

      const cellIdx = parsed.cell_number ?? 0;

      if (parsed.edit_mode === 'delete') {
        if (cellIdx < 0 || cellIdx >= notebook.cells.length) {
          return {
            content: [{ type: 'text', text: `Cell ${cellIdx} does not exist.` }],
            isError: true,
          };
        }
        notebook.cells.splice(cellIdx, 1);
      } else if (parsed.edit_mode === 'insert') {
        const newCell: NotebookCell = {
          cell_type: parsed.cell_type ?? 'code',
          source: parsed.new_source.split('\n').map((l, i, arr) =>
            i < arr.length - 1 ? `${l}\n` : l,
          ),
          metadata: {},
          ...(parsed.cell_type !== 'markdown' ? { outputs: [], execution_count: null } : {}),
        };
        notebook.cells.splice(cellIdx, 0, newCell);
      } else {
        // Replace
        if (cellIdx < 0 || cellIdx >= notebook.cells.length) {
          return {
            content: [{ type: 'text', text: `Cell ${cellIdx} does not exist.` }],
            isError: true,
          };
        }
        const cell = notebook.cells[cellIdx]!;
        cell.source = parsed.new_source.split('\n').map((l, i, arr) =>
          i < arr.length - 1 ? `${l}\n` : l,
        );
        if (parsed.cell_type) {
          cell.cell_type = parsed.cell_type;
        }
      }

      await fs.writeFile(resolved, JSON.stringify(notebook, null, 1), 'utf-8');

      return {
        content: [
          {
            type: 'text',
            text: `Successfully ${parsed.edit_mode}d cell ${cellIdx} in ${resolved}`,
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `NotebookEdit error: ${message}` }],
        isError: true,
      };
    }
  },
};
