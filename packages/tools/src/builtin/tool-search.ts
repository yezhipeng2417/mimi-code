/**
 * ToolSearch — Search for and load deferred tools.
 *
 * Special built-in that bridges the deferred loading mechanism.
 * When called, searches the registry for matching tools and returns
 * full schema details so the model can invoke them.
 *
 * For deferred tools (MCP tools registered as stubs), ToolSearch
 * reports their existence. The model can then use them directly —
 * the ToolExecutor will resolve them on demand.
 */

import { z } from 'zod';
import type { ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from '../types.js';
import type { ToolRegistry } from '../registry.js';

const inputSchema = z.object({
  query: z.string().describe('Search query for tool name or capability'),
  includeSchema: z.boolean().optional().describe('Include full input schema in results (default: false)'),
});

export function createToolSearchTool(registry: ToolRegistry): Tool {
  return {
    name: 'ToolSearch',
    description:
      'Search for available tools by name or capability. ' +
      'Returns tool names, descriptions, and optionally their input schemas. ' +
      'Use this when you need a tool that is not in the current tool list.',
    source: 'builtin',
    category: 'system',
    inputSchema,

    collapsedSummary(input: unknown) {
      const parsed = input as z.infer<typeof inputSchema>;
      return `search: ${parsed.query}`;
    },

    async execute(input: unknown, _ctx: ToolContext): Promise<ToolResult> {
      const { query, includeSchema } = inputSchema.parse(input);

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

      // Build detailed results
      let formatted: string;

      if (includeSchema) {
        // Include full schemas for precise tool invocation
        const schemas = await registry.listToolSchemas();
        const schemaMap = new Map(schemas.map((s) => [s.name, s]));

        // Also include deferred stubs
        const deferred = registry.listDeferredStubs();
        const deferredMap = new Map(deferred.map((d) => [d.name, d]));

        formatted = results
          .map((r) => {
            const schema = schemaMap.get(r.name);
            const stub = deferredMap.get(r.name);
            let entry = `### ${r.name} (${r.source})\n${r.description}`;

            if (schema?.inputSchema) {
              entry += `\n\nInput schema:\n\`\`\`json\n${JSON.stringify(schema.inputSchema, null, 2)}\n\`\`\``;
            } else if (stub) {
              entry += '\n\n*Deferred tool — call it by name and it will be loaded on demand.*';
            }

            return entry;
          })
          .join('\n\n---\n\n');
      } else {
        formatted = results
          .map((r) => `- **${r.name}** (${r.source}): ${r.description}`)
          .join('\n');
      }

      return {
        content: [
          {
            type: 'text',
            text: `Found ${results.length} tool(s) matching "${query}":\n\n${formatted}\n\n` +
              'These tools are available for use. Call them by name.',
          },
        ],
      };
    },
  };
}
