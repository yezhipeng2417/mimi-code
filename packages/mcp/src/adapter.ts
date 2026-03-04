/**
 * McpToolAdapter — Bridges MCP tools to the internal Tool interface.
 *
 * Converts MCP tool definitions into the unified Tool interface used by
 * ToolRegistry, handling FQN naming, schema conversion, and call forwarding.
 */

import { z } from 'zod';
import type { ToolContext, ToolResult, ToolResultContent, ToolSource } from '@mimi/core';
import type { McpClient, McpToolDefinition } from './client.js';

/**
 * Minimal Tool interface (avoids circular dep on @mimi/tools).
 */
export interface McpAdaptedTool {
  readonly name: string;
  readonly description: string;
  readonly source: ToolSource;
  readonly inputSchema: z.ZodType;
  readonly category: string;
  execute(input: unknown, ctx: ToolContext): Promise<ToolResult>;
  collapsedSummary?(input: unknown): string;
}

/**
 * Create adapted tools for all tools on a server.
 */
export function adaptMcpTools(
  client: McpClient,
  serverName: string,
  tools: McpToolDefinition[],
): McpAdaptedTool[] {
  return tools.map((toolDef) => createAdapter(client, serverName, toolDef));
}

/**
 * Create a single adapted tool.
 */
function createAdapter(
  client: McpClient,
  serverName: string,
  toolDef: McpToolDefinition,
): McpAdaptedTool {
  const fqn = client.getToolFQN(serverName, toolDef.name);

  // Convert JSON Schema to a permissive Zod schema
  // (MCP tool schemas are validated by the server, not us)
  const inputSchema = z.record(z.unknown());

  return {
    name: fqn,
    description: toolDef.description ?? `MCP tool: ${toolDef.name}`,
    source: 'mcp',
    category: 'mcp',
    inputSchema,

    collapsedSummary(_input: unknown) {
      return `${serverName}/${toolDef.name}`;
    },

    async execute(input: unknown, _ctx: ToolContext): Promise<ToolResult> {
      try {
        const args = (input ?? {}) as Record<string, unknown>;
        const result = await client.callTool(serverName, toolDef.name, args);

        // Convert MCP result to ToolResult
        const content: ToolResultContent[] = result.content
          .map((item) => {
            if (item.type === 'text' && item.text) {
              return { type: 'text' as const, text: item.text };
            }
            if (item.type === 'image' && item.data && item.mimeType) {
              return {
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  mediaType: item.mimeType,
                  data: item.data,
                },
              };
            }
            // Unknown content type — serialize as text
            return { type: 'text' as const, text: JSON.stringify(item) };
          });

        return {
          content: content.length > 0 ? content : [{ type: 'text', text: '(empty result)' }],
          isError: result.isError,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `MCP call failed (${serverName}/${toolDef.name}): ${message}` }],
          isError: true,
        };
      }
    },
  };
}
