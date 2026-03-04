/**
 * SkillLoader — Discovers and loads skill definitions from multiple sources.
 *
 * Discovery paths (in priority order):
 *   1. Built-in skills (bundled with mimi)
 *   2. Project-level skills (.mimi/skills/ or .claude/skills/)
 *   3. User-level skills (~/.mimi/skills/)
 *   4. Plugin-provided skills
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SkillDefinition, SkillSource } from './types.js';

/**
 * Skill file format (YAML-like, but we parse as simple key-value for now).
 * In production, use a proper YAML parser.
 *
 * Format:
 *   ---
 *   name: commit
 *   displayName: Git Commit
 *   description: Create a git commit with a good message
 *   userInvocable: true
 *   ---
 *   <prompt template>
 */
function parseSkillFile(content: string, source: SkillSource): SkillDefinition | null {
  const parts = content.split('---');
  if (parts.length < 3) return null;

  const frontmatter = parts[1]!.trim();
  const prompt = parts.slice(2).join('---').trim();

  // Simple key-value parsing
  const meta: Record<string, string> = {};
  for (const line of frontmatter.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    meta[key] = value;
  }

  if (!meta['name'] || !prompt) return null;

  return {
    name: meta['name'],
    displayName: meta['displayName'] ?? meta['name'],
    description: meta['description'] ?? '',
    prompt,
    userInvocable: meta['userInvocable'] === 'true',
    source,
    argsDescription: meta['argsDescription'],
  };
}

export class SkillLoader {
  private skills = new Map<string, SkillDefinition>();

  /**
   * Load skills from a directory.
   */
  async loadFromDirectory(dir: string, source: SkillSource): Promise<number> {
    let count = 0;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.md') && !entry.name.endsWith('.skill')) continue;

        try {
          const filePath = path.join(dir, entry.name);
          const content = await fs.readFile(filePath, 'utf-8');
          const skill = parseSkillFile(content, source);

          if (skill) {
            this.skills.set(skill.name, skill);
            count++;
          }
        } catch {
          // Skip individual file errors
        }
      }
    } catch {
      // Directory doesn't exist — that's fine
    }

    return count;
  }

  /**
   * Load skills from all standard locations.
   * Discovery order (later sources override earlier):
   *   1. User-level global skills
   *   2. Project-level skills
   *   3. Brand-provided skills (if brandSkillsDir is set)
   */
  async loadAll(
    projectPath: string,
    options?: { userHome?: string; brandSkillsDir?: string },
  ): Promise<number> {
    let total = 0;
    const home = options?.userHome ?? process.env['HOME'] ?? process.env['USERPROFILE'] ?? '.';

    // 1. User-level (~/.mimi/skills/)
    total += await this.loadFromDirectory(
      path.join(home, '.mimi', 'skills'),
      { type: 'user', path: home },
    );

    // 2. User-level (~/.claude/commands/ — Claude Code compat)
    total += await this.loadFromDirectory(
      path.join(home, '.claude', 'commands'),
      { type: 'user', path: home },
    );

    // 3. Project-level (.mimi/skills/)
    total += await this.loadFromDirectory(
      path.join(projectPath, '.mimi', 'skills'),
      { type: 'project', path: projectPath },
    );

    // 4. Project-level (.claude/commands/ — Claude Code compat)
    total += await this.loadFromDirectory(
      path.join(projectPath, '.claude', 'commands'),
      { type: 'project', path: projectPath },
    );

    // 5. Brand-provided skills directory
    if (options?.brandSkillsDir) {
      total += await this.loadFromDirectory(
        options.brandSkillsDir,
        { type: 'brand', path: options.brandSkillsDir },
      );
    }

    return total;
  }

  /**
   * Register a skill directly (from plugin or built-in).
   */
  registerSkill(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
  }

  /**
   * Get a skill by name.
   */
  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /**
   * List all loaded skills.
   */
  listSkills(): SkillDefinition[] {
    return [...this.skills.values()];
  }

  /**
   * List user-invocable skills (for slash command listing).
   */
  listUserInvocable(): SkillDefinition[] {
    return [...this.skills.values()].filter((s) => s.userInvocable);
  }

  /**
   * Get skill count.
   */
  get size(): number {
    return this.skills.size;
  }
}
