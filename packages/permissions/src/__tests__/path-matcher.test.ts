import { describe, it, expect } from 'vitest';
import { matchPath, matchCommand } from '../path-matcher.js';

describe('matchPath', () => {
  it('matches exact paths', () => {
    expect(matchPath('/test/foo.ts', '/test/foo.ts')).toBe(true);
  });

  it('matches glob patterns with **', () => {
    expect(matchPath('/test/**', '/test/src/deep/file.ts')).toBe(true);
  });

  it('does not match unrelated paths', () => {
    expect(matchPath('/test/**', '/other/file.ts')).toBe(false);
  });

  it('matches single-level wildcard *', () => {
    expect(matchPath('/test/*.ts', '/test/foo.ts')).toBe(true);
    expect(matchPath('/test/*.ts', '/test/deep/foo.ts')).toBe(false);
  });
});

describe('matchCommand', () => {
  it('matches exact commands', () => {
    expect(matchCommand('git status', 'git status')).toBe(true);
  });

  it('matches command prefix with wildcard', () => {
    expect(matchCommand('git *', 'git push origin main')).toBe(true);
  });

  it('does not match unrelated commands', () => {
    expect(matchCommand('git *', 'rm -rf /')).toBe(false);
  });
});
