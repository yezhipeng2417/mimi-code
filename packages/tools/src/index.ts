/**
 * @mimi/tools — Tool registry and built-in tool implementations.
 *
 * Depends on: @mimi/core
 */

// Core infrastructure
export { ToolRegistry } from './registry.js';
export { ToolExecutor } from './executor.js';
export type { ExecutorOptions } from './executor.js';

// Types
export type { Tool, DeferredToolStub, ToolFactory, ToolRegistryEntry } from './types.js';

// Built-in tools
export {
  readTool,
  writeTool,
  editTool,
  globTool,
  grepTool,
  bashTool,
  notebookEditTool,
  todoWriteTool,
  getTodoList,
  createToolSearchTool,
  createAskUserTool,
  getBuiltinTools,
} from './builtin/index.js';
export type { AskUserCallback } from './builtin/index.js';
