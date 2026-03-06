/**
 * Tests for the configuration loader.
 *
 * Uses tmp directories with JSON fixture files to verify the
 * priority chain: CLI flags > env vars > project config > user config > defaults.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadConfig, loadProjectInstructions, loadMcpServers, loadHooks } from '../config.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mimi-config-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ── Helpers ──────────────────────────────────────────────────────────

async function writeJson(relPath: string, data: unknown): Promise<void> {
  const fullPath = path.join(tmpDir, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, JSON.stringify(data));
}

// ── loadConfig ───────────────────────────────────────────────────────

describe('loadConfig', () => {
  it('returns hard defaults when no config files exist', async () => {
    const config = await loadConfig({
      userHome: path.join(tmpDir, 'nonexistent-home'),
      projectPath: path.join(tmpDir, 'nonexistent-project'),
    });
    expect(config.model).toBe('claude-sonnet-4-6');
    expect(config.maxTokens).toBe(16384);
    expect(config.provider).toBe('anthropic');
  });

  it('loads user config from ~/.mimi/config.json', async () => {
    await writeJson('home/.mimi/config.json', { model: 'claude-haiku-4-5-20251001' });

    const config = await loadConfig({
      userHome: path.join(tmpDir, 'home'),
    });
    expect(config.model).toBe('claude-haiku-4-5-20251001');
    // Hard defaults still present
    expect(config.maxTokens).toBe(16384);
  });

  it('project config overrides user config', async () => {
    await writeJson('home/.mimi/config.json', { model: 'claude-haiku-4-5-20251001' });
    await writeJson('project/.mimi.json', { model: 'claude-opus-4-6' });

    const config = await loadConfig({
      userHome: path.join(tmpDir, 'home'),
      projectPath: path.join(tmpDir, 'project'),
    });
    expect(config.model).toBe('claude-opus-4-6');
  });

  it('tries .mimi/config.json then .claude/settings.json for project config', async () => {
    await writeJson('project/.claude/settings.json', { model: 'claude-opus-4-6' });

    const config = await loadConfig({
      userHome: path.join(tmpDir, 'home'),
      projectPath: path.join(tmpDir, 'project'),
    });
    expect(config.model).toBe('claude-opus-4-6');
  });

  it('.mimi.json takes precedence over .mimi/config.json', async () => {
    await writeJson('project/.mimi.json', { model: 'from-root' });
    await writeJson('project/.mimi/config.json', { model: 'from-subdir' });

    const config = await loadConfig({
      projectPath: path.join(tmpDir, 'project'),
      userHome: path.join(tmpDir, 'home'),
    });
    expect(config.model).toBe('from-root');
  });

  it('environment variables override file configs', async () => {
    await writeJson('home/.mimi/config.json', { model: 'user-model' });

    const origModel = process.env['MIMI_MODEL'];
    const origTokens = process.env['MIMI_MAX_TOKENS'];
    try {
      process.env['MIMI_MODEL'] = 'env-model';
      process.env['MIMI_MAX_TOKENS'] = '4096';

      const config = await loadConfig({
        userHome: path.join(tmpDir, 'home'),
      });
      expect(config.model).toBe('env-model');
      expect(config.maxTokens).toBe(4096);
    } finally {
      if (origModel === undefined) delete process.env['MIMI_MODEL'];
      else process.env['MIMI_MODEL'] = origModel;
      if (origTokens === undefined) delete process.env['MIMI_MAX_TOKENS'];
      else process.env['MIMI_MAX_TOKENS'] = origTokens;
    }
  });

  it('CLI flags have highest priority', async () => {
    await writeJson('home/.mimi/config.json', { model: 'user-model' });

    const config = await loadConfig({
      userHome: path.join(tmpDir, 'home'),
      cliFlags: { model: 'cli-model', maxTokens: 2048 },
    });
    expect(config.model).toBe('cli-model');
    expect(config.maxTokens).toBe(2048);
  });

  it('merges mcpServers from base and overrides', async () => {
    await writeJson('home/.mimi/config.json', {
      mcpServers: { server1: { command: 'cmd1' } },
    });
    await writeJson('project/.mimi.json', {
      mcpServers: { server2: { command: 'cmd2' } },
    });

    const config = await loadConfig({
      userHome: path.join(tmpDir, 'home'),
      projectPath: path.join(tmpDir, 'project'),
    });
    expect(config.mcpServers).toEqual({
      server1: { command: 'cmd1' },
      server2: { command: 'cmd2' },
    });
  });
});

// ── loadProjectInstructions ──────────────────────────────────────────

describe('loadProjectInstructions', () => {
  it('returns undefined when no instruction files exist', async () => {
    const result = await loadProjectInstructions(path.join(tmpDir, 'empty'));
    expect(result).toBeUndefined();
  });

  it('loads MIMI.md from project root first', async () => {
    const projectDir = path.join(tmpDir, 'proj');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'MIMI.md'), '# Mimi Instructions');
    await fs.mkdir(path.join(projectDir, '.claude'), { recursive: true });
    await fs.writeFile(path.join(projectDir, 'CLAUDE.md'), '# Claude Instructions');

    const result = await loadProjectInstructions(projectDir);
    expect(result).toBe('# Mimi Instructions');
  });

  it('falls back to CLAUDE.md if MIMI.md does not exist', async () => {
    const projectDir = path.join(tmpDir, 'proj');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'CLAUDE.md'), '# Claude Instructions');

    const result = await loadProjectInstructions(projectDir);
    expect(result).toBe('# Claude Instructions');
  });

  it('loads from .mimi/MIMI.md if root MIMI.md missing', async () => {
    const projectDir = path.join(tmpDir, 'proj');
    await fs.mkdir(path.join(projectDir, '.mimi'), { recursive: true });
    await fs.writeFile(path.join(projectDir, '.mimi', 'MIMI.md'), '# Nested');

    const result = await loadProjectInstructions(projectDir);
    expect(result).toBe('# Nested');
  });
});

// ── loadMcpServers ───────────────────────────────────────────────────

describe('loadMcpServers', () => {
  it('returns empty object when no config files exist', async () => {
    const servers = await loadMcpServers(
      path.join(tmpDir, 'project'),
      path.join(tmpDir, 'home'),
    );
    expect(servers).toEqual({});
  });

  it('loads MCP servers from user config', async () => {
    await writeJson('home/.mimi/config.json', {
      mcpServers: { context7: { command: 'npx', args: ['@context7/server'] } },
    });

    const servers = await loadMcpServers(
      path.join(tmpDir, 'project'),
      path.join(tmpDir, 'home'),
    );
    expect(servers).toHaveProperty('context7');
    expect(servers['context7']!.command).toBe('npx');
  });

  it('project MCP servers override user-level ones', async () => {
    await writeJson('home/.mimi/config.json', {
      mcpServers: { srv: { command: 'user-cmd' } },
    });
    await writeJson('project/.mimi/config.json', {
      mcpServers: { srv: { command: 'project-cmd' } },
    });

    const servers = await loadMcpServers(
      path.join(tmpDir, 'project'),
      path.join(tmpDir, 'home'),
    );
    expect(servers['srv']!.command).toBe('project-cmd');
  });

  it('loads from .claude/settings.json for Claude Code compat', async () => {
    await writeJson('project/.claude/settings.json', {
      mcpServers: { playwright: { command: 'playwright-mcp' } },
    });

    const servers = await loadMcpServers(
      path.join(tmpDir, 'project'),
      path.join(tmpDir, 'home'),
    );
    expect(servers).toHaveProperty('playwright');
  });
});

// ── loadHooks ────────────────────────────────────────────────────────

describe('loadHooks', () => {
  it('returns empty array when no hook files exist', async () => {
    const hooks = await loadHooks(
      path.join(tmpDir, 'project'),
      path.join(tmpDir, 'home'),
    );
    expect(hooks).toEqual([]);
  });

  it('loads hooks from project hooks.json', async () => {
    await writeJson('project/.mimi/hooks.json', {
      hooks: {
        PreToolUse: [
          { command: 'echo pre', toolName: 'Bash', blocking: true },
        ],
        PostToolUse: [
          { command: 'echo post' },
        ],
      },
    });

    const hooks = await loadHooks(
      path.join(tmpDir, 'project'),
      path.join(tmpDir, 'home'),
    );
    expect(hooks).toHaveLength(2);
    expect(hooks[0]).toEqual({
      event: 'PreToolUse',
      command: 'echo pre',
      toolName: 'Bash',
      blocking: true,
      timeout: undefined,
    });
    expect(hooks[1]!.event).toBe('PostToolUse');
  });

  it('merges hooks from user and project sources', async () => {
    await writeJson('home/.mimi/hooks.json', {
      hooks: {
        SessionStart: [{ command: 'echo session' }],
      },
    });
    await writeJson('project/.mimi/hooks.json', {
      hooks: {
        PreToolUse: [{ command: 'echo tool' }],
      },
    });

    const hooks = await loadHooks(
      path.join(tmpDir, 'project'),
      path.join(tmpDir, 'home'),
    );
    expect(hooks).toHaveLength(2);
    const events = hooks.map((h) => h.event);
    expect(events).toContain('SessionStart');
    expect(events).toContain('PreToolUse');
  });
});
