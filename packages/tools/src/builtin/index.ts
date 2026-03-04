/**
 * Built-in tool exports.
 *
 * Each tool is exported as both:
 * 1. A direct instance (for tools with no dependencies)
 * 2. A factory function (for tools requiring DI)
 */

// Direct tool instances
export { readTool } from './read.js';
export { writeTool } from './write.js';
export { editTool } from './edit.js';
export { globTool } from './glob.js';
export { grepTool } from './grep.js';
export { bashTool } from './bash.js';
export { notebookEditTool } from './notebook-edit.js';
export { todoWriteTool, getTodoList } from './todo.js';

// Factory-created tools (require dependencies)
export { createToolSearchTool } from './tool-search.js';
export { createAskUserTool } from './ask-user.js';
export type { AskUserCallback } from './ask-user.js';
export { createSpawnAgentTool } from './spawn-agent.js';

// All built-in tools for bulk registration
import { readTool } from './read.js';
import { writeTool } from './write.js';
import { editTool } from './edit.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { bashTool } from './bash.js';
import { notebookEditTool } from './notebook-edit.js';
import { todoWriteTool } from './todo.js';
import type { Tool } from '../types.js';

/**
 * Get all built-in tools that don't require dependencies.
 * Factory-created tools (ToolSearch, AskUser) must be registered separately.
 */
export function getBuiltinTools(): Tool[] {
  return [
    readTool,
    writeTool,
    editTool,
    globTool,
    grepTool,
    bashTool,
    notebookEditTool,
    todoWriteTool,
  ];
}
