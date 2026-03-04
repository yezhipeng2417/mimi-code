/**
 * ToolRegistry — Central coordination point for all tool sources.
 *
 * Manages registration, lookup, scoping, and deferred loading.
 * Frozen after startup to preserve prompt cache invariant.
 */

import type { JsonSchema, ToolSchema, ToolSource } from '@mimi/core';
import type { z } from 'zod';
import type { DeferredToolStub, Tool, ToolFactory, ToolRegistryEntry } from './types.js';

// Convert zod schema to JSON Schema (simplified)
function zodToJsonSchema(schema: z.ZodType): JsonSchema {
  // Zod's .describe() metadata + basic shape extraction
  // In production, use zod-to-json-schema. For now, use the shape if available.
  const def = (schema as { _def?: { shape?: () => Record<string, unknown>; description?: string } })._def;
  const shape = def?.shape?.() ?? {};
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const fieldDef = (value as { _def?: { typeName?: string; description?: string; innerType?: { _def?: { typeName?: string } } } })._def;
    const isOptional = fieldDef?.typeName === 'ZodOptional';
    const innerDef = isOptional ? fieldDef?.innerType?._def : fieldDef;
    const typeName = innerDef?.typeName;

    let jsonType = 'string';
    if (typeName === 'ZodNumber') jsonType = 'number';
    else if (typeName === 'ZodBoolean') jsonType = 'boolean';
    else if (typeName === 'ZodArray') jsonType = 'array';
    else if (typeName === 'ZodObject') jsonType = 'object';

    properties[key] = {
      type: jsonType,
      ...(fieldDef?.description ? { description: fieldDef.description } : {}),
    };

    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: 'object' as const,
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

export class ToolRegistry {
  private entries = new Map<string, ToolRegistryEntry>();
  private frozen = false;

  /**
   * Register a built-in tool with lazy-loaded implementation.
   */
  registerBuiltin(name: string, factory: ToolFactory, schema?: z.ZodType): void {
    this.ensureNotFrozen();
    this.entries.set(name, {
      tool: null,
      factory,
      stub: schema
        ? null
        : null,
    });
    // If schema provided, we can create a lightweight entry
    if (schema) {
      // Pre-store the schema info for getToolSchema
      const entry = this.entries.get(name)!;
      entry.stub = null; // Not deferred — factory will provide full tool
    }
  }

  /**
   * Register an already-instantiated tool.
   */
  registerTool(tool: Tool): void {
    this.ensureNotFrozen();
    this.entries.set(tool.name, {
      tool,
      factory: null,
      stub: null,
    });
  }

  /**
   * Register a deferred tool stub (e.g., MCP tools with expensive schemas).
   */
  registerDeferred(stub: DeferredToolStub): void {
    this.ensureNotFrozen();
    this.entries.set(stub.name, {
      tool: null,
      factory: null,
      stub,
    });
  }

  /**
   * Freeze registry — no more registrations after this.
   * Called after startup completes.
   */
  freeze(): void {
    this.frozen = true;
  }

  /**
   * Get a tool by name, loading lazily if needed.
   */
  async getTool(name: string): Promise<Tool | undefined> {
    const entry = this.entries.get(name);
    if (!entry) return undefined;

    if (entry.tool) return entry.tool;

    if (entry.factory) {
      entry.tool = await entry.factory();
      return entry.tool;
    }

    // Deferred stub — cannot execute directly
    return undefined;
  }

  /**
   * Check if a tool is registered (including deferred).
   */
  has(name: string): boolean {
    return this.entries.has(name);
  }

  /**
   * List all tool schemas for LLM context.
   * Only includes tools with full schemas (not deferred stubs).
   */
  async listToolSchemas(): Promise<ToolSchema[]> {
    const schemas: ToolSchema[] = [];

    for (const [name, entry] of this.entries) {
      if (entry.stub?.deferLoading) continue; // Skip deferred

      const tool = await this.resolveTool(entry);
      if (tool) {
        schemas.push({
          name,
          description: tool.description,
          inputSchema: zodToJsonSchema(tool.inputSchema),
        });
      }
    }

    return schemas;
  }

  /**
   * List deferred tool stubs (for ToolSearch).
   */
  listDeferredStubs(): DeferredToolStub[] {
    const stubs: DeferredToolStub[] = [];
    for (const entry of this.entries.values()) {
      if (entry.stub?.deferLoading) {
        stubs.push(entry.stub);
      }
    }
    return stubs;
  }

  /**
   * Search tools by query string (name or description match).
   */
  async search(query: string): Promise<Array<{ name: string; description: string; source: ToolSource }>> {
    const results: Array<{ name: string; description: string; source: ToolSource }> = [];
    const lowerQuery = query.toLowerCase();

    for (const [name, entry] of this.entries) {
      if (entry.stub?.deferLoading) {
        if (
          entry.stub.name.toLowerCase().includes(lowerQuery) ||
          entry.stub.description.toLowerCase().includes(lowerQuery)
        ) {
          results.push({
            name: entry.stub.name,
            description: entry.stub.description,
            source: entry.stub.source,
          });
        }
        continue;
      }

      const tool = await this.resolveTool(entry);
      if (
        tool &&
        (name.toLowerCase().includes(lowerQuery) ||
          tool.description.toLowerCase().includes(lowerQuery))
      ) {
        results.push({
          name,
          description: tool.description,
          source: tool.source,
        });
      }
    }

    return results;
  }

  /**
   * Load a deferred tool's full schema (called by ToolSearch).
   * Returns the loaded tool, or undefined if not deferred.
   */
  async loadDeferredTool(name: string, factory: ToolFactory): Promise<Tool | undefined> {
    const entry = this.entries.get(name);
    if (!entry?.stub?.deferLoading) return undefined;

    const tool = await factory();
    // Replace the deferred stub with the real tool
    entry.tool = tool;
    entry.stub = null;
    entry.factory = null;
    return tool;
  }

  /**
   * Create a filtered view for sub-agents.
   */
  createFiltered(allowedTools: string[]): ToolRegistry {
    const filtered = new ToolRegistry();
    const allowed = new Set(allowedTools);

    for (const [name, entry] of this.entries) {
      if (allowed.has(name)) {
        filtered.entries.set(name, entry);
      }
    }

    filtered.frozen = true; // Child registries are always frozen
    return filtered;
  }

  /**
   * Get all tool names.
   */
  getToolNames(): string[] {
    return [...this.entries.keys()];
  }

  /**
   * Dispose all tools.
   */
  async dispose(): Promise<void> {
    for (const entry of this.entries.values()) {
      if (entry.tool?.dispose) {
        await entry.tool.dispose();
      }
    }
    this.entries.clear();
  }

  // ── Private ─────────────────────────────────────────────────────────

  private ensureNotFrozen(): void {
    if (this.frozen) {
      throw new Error(
        'ToolRegistry is frozen. Cannot register tools after startup. ' +
          'Use ToolSearch for deferred loading.',
      );
    }
  }

  private async resolveTool(entry: ToolRegistryEntry): Promise<Tool | null> {
    if (entry.tool) return entry.tool;
    if (entry.factory) {
      entry.tool = await entry.factory();
      return entry.tool;
    }
    return null;
  }
}
