import { describe, it, expect } from 'vitest';
import { PromptAssembler } from '../prompt-assembler.js';

describe('PromptAssembler', () => {
  function createAssembler(overrides?: Partial<ConstructorParameters<typeof PromptAssembler>[0]>) {
    return new PromptAssembler({
      coreSystemPrompt: 'You are a helpful assistant.',
      defaultModel: 'claude-sonnet-4-6',
      defaultMaxTokens: 4096,
      ...overrides,
    });
  }

  it('should build a basic request with system prompt and messages', () => {
    const assembler = createAssembler();
    assembler.freezeTools([]);

    const result = assembler.build([
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
    ]);

    expect(result.params.model).toBe('claude-sonnet-4-6');
    expect(result.params.maxTokens).toBe(4096);
    expect(result.params.system.length).toBeGreaterThan(0);
    expect(result.params.messages.length).toBe(1);
    expect(result.meta.messageCount).toBe(1);
  });

  it('should include brand prepend and append in system prompt', () => {
    const assembler = createAssembler({
      brandPrepend: 'You are AcmeBot.',
      brandAppend: 'Always be polite.',
    });
    assembler.freezeTools([]);

    const result = assembler.build([]);
    const systemText = result.params.system.map((s) => s.text).join(' ');

    expect(systemText).toContain('You are AcmeBot.');
    expect(systemText).toContain('Always be polite.');
    expect(systemText).toContain('You are a helpful assistant.');
  });

  it('should include project config as first message pair', () => {
    const assembler = createAssembler();
    assembler.freezeTools([]);
    assembler.setProjectConfig({
      instructions: 'Follow TypeScript coding standards.',
    });

    const result = assembler.build([]);

    // Project config is injected as the first user message (Layer 3), not in system blocks
    expect(result.params.messages.length).toBe(2); // user + assistant acknowledgment
    const firstMsg = result.params.messages[0]!;
    expect(firstMsg.role).toBe('user');
    const text = (firstMsg.content[0] as { type: 'text'; text: string }).text;
    expect(text).toContain('Follow TypeScript coding standards.');
    expect(result.meta.hasProjectConfig).toBe(true);
  });

  it('should throw when freezeTools called twice', () => {
    const assembler = createAssembler();
    assembler.freezeTools([]);

    expect(() => assembler.freezeTools([])).toThrow('Tools already frozen');
  });

  it('should sort tools alphabetically', () => {
    const assembler = createAssembler();
    assembler.freezeTools([
      { name: 'Write', description: 'Write files', inputSchema: {} as any },
      { name: 'Read', description: 'Read files', inputSchema: {} as any },
      { name: 'Bash', description: 'Run commands', inputSchema: {} as any },
    ]);

    const result = assembler.build([]);
    expect(result.params.tools?.[0]?.name).toBe('Bash');
    expect(result.params.tools?.[1]?.name).toBe('Read');
    expect(result.params.tools?.[2]?.name).toBe('Write');
    expect(result.meta.toolCount).toBe(3);
  });

  it('should inject system reminders into the request', () => {
    const assembler = createAssembler();
    assembler.freezeTools([]);

    const result = assembler.build(
      [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      [{ text: 'Remember to use tools.' }],
    );

    expect(result.meta.reminderCount).toBe(1);
  });
});
