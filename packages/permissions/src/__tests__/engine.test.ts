import { describe, it, expect } from 'vitest';
import { PermissionEngine } from '../engine.js';

describe('PermissionEngine', () => {
  it('defaults to ask when no rules match', async () => {
    const engine = new PermissionEngine({ projectPath: '/test' });
    const result = await engine.check('Read', { file_path: '/test/foo.ts' });
    expect(result.decision).toBe('ask');
  });

  it('allows tools matching config allow rules', async () => {
    const engine = new PermissionEngine({
      projectPath: '/test',
      rules: [
        { tool: 'Read', decision: 'allow' },
      ],
    });
    const result = await engine.check('Read', { file_path: '/test/foo.ts' });
    expect(result.decision).toBe('allow');
  });

  it('denies tools matching config deny rules', async () => {
    const engine = new PermissionEngine({
      projectPath: '/test',
      rules: [
        { tool: 'Bash', decision: 'deny' },
      ],
    });
    const result = await engine.check('Bash', { command: 'rm -rf /' });
    expect(result.decision).toBe('deny');
  });

  it('session rules override default ask', async () => {
    const engine = new PermissionEngine({ projectPath: '/test' });
    engine.addSessionRule('Write', 'allow');
    const result = await engine.check('Write', {});
    expect(result.decision).toBe('allow');
  });

  it('config rules take priority over session rules', async () => {
    const engine = new PermissionEngine({
      projectPath: '/test',
      rules: [
        { tool: 'Bash', decision: 'deny' },
      ],
    });
    engine.addSessionRule('Bash', 'allow');
    const result = await engine.check('Bash', { command: 'echo hi' });
    expect(result.decision).toBe('deny');
  });

  it('pattern matching restricts to specific paths', async () => {
    const engine = new PermissionEngine({
      projectPath: '/test',
      rules: [
        { tool: 'Read', decision: 'allow', pattern: '/test/**' },
      ],
    });
    const inScope = await engine.check('Read', { file_path: '/test/src/foo.ts' });
    expect(inScope.decision).toBe('allow');

    const outOfScope = await engine.check('Read', { file_path: '/etc/passwd' });
    expect(outOfScope.decision).toBe('ask');
  });
});
