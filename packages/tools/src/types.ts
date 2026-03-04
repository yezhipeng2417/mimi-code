/**
 * Tool system types for @mimi/tools.
 *
 * Extends core types with implementation-specific interfaces.
 */

import type { ToolContext, ToolResult, ToolSource } from '@mimi/core';
import type { z } from 'zod';

/**
 * Every tool (built-in, MCP, plugin, skill) implements this interface.
 */
export interface Tool {
  /** Unique name: "Read", "mcp__server__tool" */
  readonly name: string;

  /** Short description for LLM prompt */
  readonly description: string;

  /** Origin: builtin, mcp, plugin, skill */
  readonly source: ToolSource;

  /** Zod schema for input validation */
  readonly inputSchema: z.ZodType;

  /** Execute the tool */
  execute(input: unknown, ctx: ToolContext): Promise<ToolResult>;

  /** Optional lifecycle */
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;

  /** Category for UI grouping */
  readonly category?: string;

  /** Short summary for collapsed UI display */
  collapsedSummary?(input: unknown): string;
}

/**
 * Deferred tool stub — registered at startup without full schema.
 * Used for MCP tools with expensive schemas.
 */
export interface DeferredToolStub {
  name: string;
  description: string;
  deferLoading: true;
  source: ToolSource;
}

/**
 * Factory for lazy-loading tool implementations.
 */
export type ToolFactory = () => Promise<Tool>;

/**
 * Registration entry in the registry.
 */
export interface ToolRegistryEntry {
  tool: Tool | null;
  factory: ToolFactory | null;
  stub: DeferredToolStub | null;
}
