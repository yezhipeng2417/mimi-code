import { describe, it, expect } from 'vitest';
import { SkillLoader } from '../loader.js';
import { SkillRunner } from '../runner.js';

describe('SkillRunner', () => {
  function setupRunner() {
    const loader = new SkillLoader();
    loader.registerSkill({
      name: 'test-skill',
      displayName: 'Test Skill',
      description: 'A test skill',
      prompt: 'Do {{args}} in {{cwd}} on {{date}} using {{model}}',
      userInvocable: true,
      source: { type: 'builtin' },
    });
    const runner = new SkillRunner(loader);
    runner.setContext({
      cwd: '/test/project',
      model: 'claude-sonnet-4-6',
      projectPath: '/test/project',
    });
    return runner;
  }

  it('should expand {{args}} in template', () => {
    const runner = setupRunner();
    const result = runner.run('test-skill', 'something cool');
    expect(result).toBeDefined();
    expect(result!.expandedPrompt).toContain('Do something cool');
  });

  it('should expand context variables', () => {
    const runner = setupRunner();
    const result = runner.run('test-skill', 'task');
    expect(result!.expandedPrompt).toContain('/test/project');
    expect(result!.expandedPrompt).toContain('claude-sonnet-4-6');
    // Date format: YYYY-MM-DD
    expect(result!.expandedPrompt).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('should return undefined for unknown skills', () => {
    const runner = setupRunner();
    expect(runner.run('nonexistent')).toBeUndefined();
  });

  it('should replace {{args}} with empty string when no args', () => {
    const runner = setupRunner();
    const result = runner.run('test-skill');
    expect(result!.expandedPrompt).toContain('Do  in');
  });

  it('should include metadata in result', () => {
    const runner = setupRunner();
    const result = runner.run('test-skill', 'thing');
    expect(result!.metadata.skillName).toBe('test-skill');
    expect(result!.metadata.args).toBe('thing');
  });
});
