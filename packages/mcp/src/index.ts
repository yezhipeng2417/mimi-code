/**
 * @mimi/mcp — MCP client, transport, and tool adapter.
 *
 * Depends on: @mimi/core
 */

// Client
export { McpClient } from './client.js';
export type {
  McpToolDefinition,
  McpToolCallResult,
  McpServerState,
} from './client.js';

// Transport
export { StdioTransport } from './transport.js';
export type {
  McpTransport,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from './transport.js';

// Adapter
export { adaptMcpTools } from './adapter.js';
export type { McpAdaptedTool } from './adapter.js';
