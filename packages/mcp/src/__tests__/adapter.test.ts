import { describe, it, expect, vi } from 'vitest';
import { adaptMcpTools } from '../adapter.js';
import type { McpClient, McpToolDefinition } from '../client.js';
import type { ToolContext } from '@mimi/core';

function mockClient(callResult = { content: [{ type: 'text', text: 'ok' }], isError: false }): McpClient {
  return {
    getToolFQN: (server: string, tool: string) => `mcp__${server}__${tool}`,
    callTool: vi.fn().mockResolvedValue(callResult),
  } as unknown as McpClient;
}

const dummyCtx: ToolContext = {
  sessionId: 'test',
  workingDirectory: '/tmp',
  abortSignal: new AbortController().signal,
  permissions: { check: async () => ({ decision: 'allow' as const }) },
  eventBus: { emit: () => {} },
  resourceManager: { cleanupSession: () => {} },
};

describe('adaptMcpTools', () => {
  it('should create adapted tools with FQN names', () => {
    const client = mockClient();
    const tools: McpToolDefinition[] = [
      { name: 'search', description: 'Search docs' },
      { name: 'query', description: 'Query data' },
    ];

    const adapted = adaptMcpTools(client, 'myserver', tools);

    expect(adapted).toHaveLength(2);
    expect(adapted[0]!.name).toBe('mcp__myserver__search');
    expect(adapted[1]!.name).toBe('mcp__myserver__query');
  });

  it('should set source to mcp', () => {
    const client = mockClient();
    const adapted = adaptMcpTools(client, 'srv', [{ name: 'tool1' }]);
    expect(adapted[0]!.source).toBe('mcp');
  });

  it('should provide collapsedSummary', () => {
    const client = mockClient();
    const adapted = adaptMcpTools(client, 'context7', [{ name: 'resolve' }]);
    expect(adapted[0]!.collapsedSummary!({})).toBe('context7/resolve');
  });

  it('should forward execute to McpClient.callTool', async () => {
    const client = mockClient({ content: [{ type: 'text', text: 'result!' }], isError: false });
    const adapted = adaptMcpTools(client, 'srv', [{ name: 'search' }]);

    const result = await adapted[0]!.execute({ query: 'test' }, dummyCtx);

    expect(client.callTool).toHaveBeenCalledWith('srv', 'search', { query: 'test' });
    expect(result.content[0]).toEqual({ type: 'text', text: 'result!' });
    expect(result.isError).toBe(false);
  });

  it('should handle MCP errors gracefully', async () => {
    const client = mockClient();
    (client.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection lost'));

    const adapted = adaptMcpTools(client, 'srv', [{ name: 'broken' }]);
    const result = await adapted[0]!.execute({}, dummyCtx);

    expect(result.isError).toBe(true);
    expect(result.content[0]!.type).toBe('text');
    expect((result.content[0] as { type: 'text'; text: string }).text).toContain('Connection lost');
  });

  it('should handle empty results', async () => {
    const client = mockClient({ content: [], isError: false });
    const adapted = adaptMcpTools(client, 'srv', [{ name: 'empty' }]);
    const result = await adapted[0]!.execute({}, dummyCtx);

    expect(result.content[0]).toEqual({ type: 'text', text: '(empty result)' });
  });

  it('should use default description for tools without one', () => {
    const client = mockClient();
    const adapted = adaptMcpTools(client, 'srv', [{ name: 'nodesc' }]);
    expect(adapted[0]!.description).toBe('MCP tool: nodesc');
  });
});
