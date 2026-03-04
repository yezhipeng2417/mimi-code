/**
 * McpClient — Manages connections to MCP servers.
 *
 * Handles server lifecycle, tool listing, and tool calling.
 */

import type { McpServerConfig, ToolSource } from '@mimi/core';
import type { JsonRpcNotification, McpTransport } from './transport.js';
import { StdioTransport } from './transport.js';

/**
 * MCP tool definition from server.
 */
export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * MCP tool call result.
 */
export interface McpToolCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * Server connection state.
 */
export interface McpServerState {
  name: string;
  config: McpServerConfig;
  transport: McpTransport | null;
  tools: McpToolDefinition[];
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
  instructions?: string;
}

export class McpClient {
  private servers = new Map<string, McpServerState>();
  private nextRequestId = 1;
  private notificationHandlers: Array<(serverName: string, notification: JsonRpcNotification) => void> = [];

  /**
   * Register a server configuration (doesn't connect yet).
   */
  registerServer(name: string, config: McpServerConfig): void {
    this.servers.set(name, {
      name,
      config,
      transport: null,
      tools: [],
      status: 'disconnected',
    });
  }

  /**
   * Connect to a registered server and discover its tools.
   */
  async connectServer(name: string): Promise<McpToolDefinition[]> {
    const state = this.servers.get(name);
    if (!state) throw new Error(`Unknown MCP server: ${name}`);

    if (state.config.disabled) {
      state.status = 'disconnected';
      return [];
    }

    state.status = 'connecting';

    try {
      // Create transport
      if (state.config.command) {
        state.transport = new StdioTransport(
          state.config.command,
          state.config.args ?? [],
          state.config.env,
        );
      } else if (state.config.url) {
        // SSE transport would go here — for now, only stdio is supported
        throw new Error('SSE transport not yet implemented. Use stdio transport.');
      } else {
        throw new Error(`No command or url specified for MCP server "${name}"`);
      }

      await state.transport.start();

      // Forward notifications
      state.transport.onNotification((notification) => {
        for (const handler of this.notificationHandlers) {
          handler(name, notification);
        }
      });

      // Initialize
      const initResponse = await state.transport.send({
        jsonrpc: '2.0',
        id: this.nextRequestId++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          clientInfo: {
            name: 'mimi',
            version: '0.1.0',
          },
        },
      });

      if (initResponse.error) {
        throw new Error(`MCP initialize failed: ${initResponse.error.message}`);
      }

      // Extract server instructions if available
      const result = initResponse.result as { instructions?: string } | undefined;
      if (result?.instructions) {
        state.instructions = result.instructions;
      }

      // Send initialized notification
      state.transport.send({
        jsonrpc: '2.0',
        id: this.nextRequestId++,
        method: 'notifications/initialized',
        params: {},
      }).catch(() => { /* notification, no response expected */ });

      // List tools
      const toolsResponse = await state.transport.send({
        jsonrpc: '2.0',
        id: this.nextRequestId++,
        method: 'tools/list',
        params: {},
      });

      if (toolsResponse.error) {
        throw new Error(`MCP tools/list failed: ${toolsResponse.error.message}`);
      }

      const toolsList = toolsResponse.result as { tools?: McpToolDefinition[] } | undefined;
      state.tools = toolsList?.tools ?? [];

      // Filter disabled tools
      if (state.config.disabledTools?.length) {
        const disabled = new Set(state.config.disabledTools);
        state.tools = state.tools.filter((t) => !disabled.has(t.name));
      }

      state.status = 'connected';
      return state.tools;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      state.status = 'error';
      state.error = message;
      throw error;
    }
  }

  /**
   * Connect to all registered servers.
   * Returns tools from all successfully connected servers.
   */
  async connectAll(): Promise<Map<string, McpToolDefinition[]>> {
    const results = new Map<string, McpToolDefinition[]>();

    const connectPromises = [...this.servers.keys()].map(async (name) => {
      try {
        const tools = await this.connectServer(name);
        results.set(name, tools);
      } catch {
        results.set(name, []);
      }
    });

    await Promise.allSettled(connectPromises);
    return results;
  }

  /**
   * Call a tool on a specific server.
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<McpToolCallResult> {
    const state = this.servers.get(serverName);
    if (!state) throw new Error(`Unknown MCP server: ${serverName}`);
    if (!state.transport || state.status !== 'connected') {
      throw new Error(`MCP server "${serverName}" is not connected`);
    }

    const response = await state.transport.send({
      jsonrpc: '2.0',
      id: this.nextRequestId++,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    });

    if (response.error) {
      return {
        content: [{ type: 'text', text: `MCP error: ${response.error.message}` }],
        isError: true,
      };
    }

    return (response.result as McpToolCallResult) ?? {
      content: [{ type: 'text', text: '(no result)' }],
    };
  }

  /**
   * Get the fully-qualified tool name for an MCP tool.
   */
  getToolFQN(serverName: string, toolName: string): string {
    return `mcp__${serverName}__${toolName}`;
  }

  /**
   * Parse an FQN back to server + tool name.
   */
  static parseFQN(fqn: string): { serverName: string; toolName: string } | undefined {
    const match = /^mcp__([^_]+(?:__[^_]+)*)__([^_]+)$/.exec(fqn);
    if (!match) return undefined;
    // More robust: split on double underscore, first segment is server, rest is tool
    const parts = fqn.slice(5).split('__');
    if (parts.length < 2) return undefined;
    return {
      serverName: parts[0]!,
      toolName: parts.slice(1).join('__'),
    };
  }

  /**
   * Get tool source for FQN generation.
   */
  getToolSource(): ToolSource {
    return 'mcp';
  }

  /**
   * Get server instructions (for system prompt injection).
   */
  getServerInstructions(): Map<string, string> {
    const instructions = new Map<string, string>();
    for (const [name, state] of this.servers) {
      if (state.instructions) {
        instructions.set(name, state.instructions);
      }
    }
    return instructions;
  }

  /**
   * Get server states for status display.
   */
  getServerStates(): Map<string, McpServerState> {
    return new Map(this.servers);
  }

  /**
   * Subscribe to server notifications.
   */
  onNotification(handler: (serverName: string, notification: JsonRpcNotification) => void): void {
    this.notificationHandlers.push(handler);
  }

  /**
   * Disconnect from all servers.
   */
  async dispose(): Promise<void> {
    const closePromises = [...this.servers.values()].map(async (state) => {
      if (state.transport) {
        await state.transport.close();
        state.transport = null;
        state.status = 'disconnected';
      }
    });
    await Promise.allSettled(closePromises);
    this.servers.clear();
  }
}
