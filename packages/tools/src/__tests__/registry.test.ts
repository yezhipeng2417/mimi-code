import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../registry.js';
import type { Tool } from '../types.js';

function makeTool(name: string): Tool {
  return {
    name,
    description: `Test tool: ${name}`,
    inputSchema: z.object({ value: z.string() }),
    execute: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
  };
}

describe('ToolRegistry', () => {
  it('registers and retrieves a tool', async () => {
    const registry = new ToolRegistry();
    registry.registerTool(makeTool('TestTool'));
    const tool = await registry.getTool('TestTool');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('TestTool');
  });

  it('returns undefined for unknown tools', async () => {
    const registry = new ToolRegistry();
    const tool = await registry.getTool('NonExistent');
    expect(tool).toBeUndefined();
  });

  it('lists tool names', () => {
    const registry = new ToolRegistry();
    registry.registerTool(makeTool('A'));
    registry.registerTool(makeTool('B'));
    const names = registry.getToolNames();
    expect(names).toContain('A');
    expect(names).toContain('B');
    expect(names.length).toBe(2);
  });

  it('prevents registration after freeze', () => {
    const registry = new ToolRegistry();
    registry.registerTool(makeTool('A'));
    registry.freeze();
    expect(() => registry.registerTool(makeTool('B'))).toThrow();
  });

  it('lists tool schemas', async () => {
    const registry = new ToolRegistry();
    registry.registerTool(makeTool('Read'));
    const schemas = await registry.listToolSchemas();
    expect(schemas.length).toBe(1);
    expect(schemas[0]!.name).toBe('Read');
  });
});
