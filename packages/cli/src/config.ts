/**
 * Configuration loader — reads and merges config from multiple sources.
 *
 * Priority (highest to lowest):
 *   1. CLI flags
 *   2. Environment variables
 *   3. Project config (.mimi/config.json or .claude/settings.json)
 *   4. User config (~/.mimi/config.json)
 *   5. Brand defaults
 *   6. Hard defaults
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { MimiConfig, McpServerConfig } from '@mimi/core';

const HARD_DEFAULTS: MimiConfig = {
  model: 'claude-sonnet-4-6',
  maxTokens: 16384,
  provider: 'anthropic',
};

export interface ConfigSources {
  cliFlags?: Partial<MimiConfig>;
  projectPath?: string;
  userHome?: string;
}

export async function loadConfig(sources: ConfigSources = {}): Promise<MimiConfig> {
  const home = sources.userHome ?? process.env['HOME'] ?? process.env['USERPROFILE'] ?? '.';

  let config: MimiConfig = { ...HARD_DEFAULTS };

  // Load user config
  const userConfig = await tryLoadJson<Partial<MimiConfig>>(
    path.join(home, '.mimi', 'config.json'),
  );
  if (userConfig) {
    config = mergeConfig(config, userConfig);
  }

  // Load project config
  if (sources.projectPath) {
    const projectConfig =
      (await tryLoadJson<Partial<MimiConfig>>(
        path.join(sources.projectPath, '.mimi.json'),
      )) ??
      (await tryLoadJson<Partial<MimiConfig>>(
        path.join(sources.projectPath, '.mimi', 'config.json'),
      )) ??
      (await tryLoadJson<Partial<MimiConfig>>(
        path.join(sources.projectPath, '.claude', 'settings.json'),
      ));

    if (projectConfig) {
      config = mergeConfig(config, projectConfig);
    }
  }

  // Environment variables
  if (process.env['ANTHROPIC_API_KEY']) {
    config.apiKey = process.env['ANTHROPIC_API_KEY'];
  }
  if (process.env['MIMI_MODEL']) {
    config.model = process.env['MIMI_MODEL'];
  }
  if (process.env['MIMI_MAX_TOKENS']) {
    config.maxTokens = parseInt(process.env['MIMI_MAX_TOKENS'], 10);
  }

  // CLI flags (highest priority)
  if (sources.cliFlags) {
    config = mergeConfig(config, sources.cliFlags);
  }

  return config;
}

/**
 * Load project instructions from MIMI.md or CLAUDE.md.
 */
export async function loadProjectInstructions(projectPath: string): Promise<string | undefined> {
  const candidates = [
    path.join(projectPath, 'MIMI.md'),
    path.join(projectPath, '.mimi', 'MIMI.md'),
    path.join(projectPath, 'CLAUDE.md'),
    path.join(projectPath, '.claude', 'CLAUDE.md'),
  ];

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, 'utf-8');
    } catch {
      continue;
    }
  }

  return undefined;
}

/**
 * Load MCP server configurations from settings.
 */
export async function loadMcpServers(
  projectPath: string,
  userHome?: string,
): Promise<Record<string, McpServerConfig>> {
  const home = userHome ?? process.env['HOME'] ?? process.env['USERPROFILE'] ?? '.';
  let servers: Record<string, McpServerConfig> = {};

  // User-level MCP settings
  const userSettings = await tryLoadJson<{ mcpServers?: Record<string, McpServerConfig> }>(
    path.join(home, '.mimi', 'config.json'),
  );
  if (userSettings?.mcpServers) {
    servers = { ...servers, ...userSettings.mcpServers };
  }

  // Project-level MCP settings
  const projectSettings = await tryLoadJson<{ mcpServers?: Record<string, McpServerConfig> }>(
    path.join(projectPath, '.mimi', 'config.json'),
  );
  if (projectSettings?.mcpServers) {
    servers = { ...servers, ...projectSettings.mcpServers };
  }

  // Claude Code compat
  const claudeSettings = await tryLoadJson<{ mcpServers?: Record<string, McpServerConfig> }>(
    path.join(projectPath, '.claude', 'settings.json'),
  );
  if (claudeSettings?.mcpServers) {
    servers = { ...servers, ...claudeSettings.mcpServers };
  }

  return servers;
}

/**
 * Load hook configurations from .mimi/hooks.json or .claude/settings.json hooks section.
 *
 * hooks.json format:
 * {
 *   "hooks": {
 *     "PreToolUse": [{ "command": "...", "toolName": "Bash", "blocking": true }],
 *     "PostToolUse": [{ "command": "..." }]
 *   }
 * }
 */
export async function loadHooks(
  projectPath: string,
  userHome?: string,
): Promise<Array<{ event: string; command: string; toolName?: string; timeout?: number; blocking?: boolean }>> {
  const home = userHome ?? process.env['HOME'] ?? process.env['USERPROFILE'] ?? '.';
  const hooks: Array<{ event: string; command: string; toolName?: string; timeout?: number; blocking?: boolean }> = [];

  // Load from multiple sources (project overrides user)
  const sources = [
    path.join(home, '.mimi', 'hooks.json'),
    path.join(projectPath, '.mimi', 'hooks.json'),
    path.join(projectPath, '.claude', 'settings.json'),
  ];

  for (const source of sources) {
    const data = await tryLoadJson<{
      hooks?: Record<string, Array<{ command: string; toolName?: string; timeout?: number; blocking?: boolean }>>;
    }>(source);

    if (data?.hooks) {
      for (const [event, eventHooks] of Object.entries(data.hooks)) {
        for (const hook of eventHooks) {
          hooks.push({
            event,
            command: hook.command,
            toolName: hook.toolName,
            timeout: hook.timeout,
            blocking: hook.blocking,
          });
        }
      }
    }
  }

  return hooks;
}

// ── Helpers ───────────────────────────────────────────────────────────

async function tryLoadJson<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function mergeConfig(base: MimiConfig, overrides: Partial<MimiConfig>): MimiConfig {
  return {
    ...base,
    ...overrides,
    mcpServers: overrides.mcpServers
      ? { ...base.mcpServers, ...overrides.mcpServers }
      : base.mcpServers,
    permissions: overrides.permissions ?? base.permissions,
  };
}
