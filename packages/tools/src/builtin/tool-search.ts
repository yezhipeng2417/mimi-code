/**
 * ToolSearch — Search for and load deferred tools.
 *
 * Special built-in that bridges the deferred loading mechanism.
 * When called, searches the registry for matching tools and returns descriptions.
 */

import { z } from 'zod';
import type { ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from '../types.js';
import type { ToolRegistry } from '../registry.js';

const inputSchema = z.object({
  query: z.string().describe('Search query for tool name or capability'),
});

export function createToolSearchTool(registry: ToolRegistry): Tool {
  return {
    name: 'ToolSearch',
    description:
      'Search for additional tools by name or capability. ' +
      'Returns descriptions of matching tools that can be loaded for use.',
    source: 'builtin',
    category: 'system',
    inputSchema,

    collapsedSummary(input: unknown) {
      const parsed = input as z.infer<typeof inputSchema>;
      return `search: ${parsed.query}`;
    },

    async execute(input: unknown, _ctx: ToolContext): Promise<ToolResult> {
      const { query } = inputSchema.parse(input);

      const results = await registry.search(query);

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No tools found matching "${query}". Try a different search term.`,
            },
          ],
        };
      }

      const formatted = results
        .map((r) => `- **${r.name}** (${r.source}): ${r.description}`)
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${results.length} tool(s) matching "${query}":\n\n${formatted}\n\n` +
              'These tools are now available for use in this conversation.',
          },
        ],
      };
    },
  };
}
