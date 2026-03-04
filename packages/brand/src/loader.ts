/**
 * BrandLoader — Loads and validates brand.json configuration.
 *
 * Discovery order:
 *   1. Explicit path (--brand flag)
 *   2. Project-level (.mimi/brand.json or .claude/brand.json)
 *   3. User-level (~/.mimi/brand.json)
 *   4. Default (no brand — vanilla Mimi)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { BrandConfig } from './types.js';
import { validateBrandConfig } from './schema.js';

/**
 * Default brand configuration (vanilla Mimi).
 */
export const DEFAULT_BRAND: BrandConfig = {
  name: 'Mimi',
  description: 'An open-source CLI agent — powered by your favorite parrot.',
  defaultModel: 'claude-sonnet-4-6',
  defaultMaxTokens: 16384,
  welcomeMessage: 'Hi! I\'m Mimi, your coding assistant. How can I help?',
};

export class BrandLoader {
  private brand: BrandConfig = DEFAULT_BRAND;

  /**
   * Load brand configuration.
   */
  async load(options?: {
    explicitPath?: string;
    projectPath?: string;
    userHome?: string;
  }): Promise<BrandConfig> {
    const home = options?.userHome ?? process.env['HOME'] ?? process.env['USERPROFILE'] ?? '.';

    // Discovery order
    const candidates: string[] = [];

    if (options?.explicitPath) {
      candidates.push(options.explicitPath);
    }

    if (options?.projectPath) {
      candidates.push(path.join(options.projectPath, '.mimi', 'brand.json'));
      candidates.push(path.join(options.projectPath, '.claude', 'brand.json'));
    }

    candidates.push(path.join(home, '.mimi', 'brand.json'));

    for (const candidate of candidates) {
      try {
        const raw = await fs.readFile(candidate, 'utf-8');
        const json = JSON.parse(raw) as unknown;

        // Validate with Zod schema
        const validated = validateBrandConfig(json);

        // Merge with defaults
        this.brand = {
          ...DEFAULT_BRAND,
          ...validated,
          prompt: validated.prompt ? { ...validated.prompt } : undefined,
          theme: validated.theme ? { ...validated.theme } : undefined,
        } as BrandConfig;

        return this.brand;
      } catch (err) {
        // If file simply doesn't exist, try next candidate
        if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
          continue;
        }
        // If JSON parse error or validation error on an explicit path, re-throw
        if (candidate === options?.explicitPath) {
          throw new Error(`Invalid brand.json at ${candidate}: ${err instanceof Error ? err.message : String(err)}`);
        }
        // Otherwise silently skip invalid files
        continue;
      }
    }

    // No brand found — use defaults
    this.brand = DEFAULT_BRAND;
    return this.brand;
  }

  /**
   * Get the loaded brand config.
   */
  getBrand(): BrandConfig {
    return this.brand;
  }

  /**
   * Get the system prompt prepend text.
   */
  getPromptPrepend(): string | undefined {
    return this.brand.prompt?.prepend;
  }

  /**
   * Get the system prompt append text.
   */
  getPromptAppend(): string | undefined {
    return this.brand.prompt?.append;
  }

  /**
   * Get the full system prompt replacement (if any).
   */
  getPromptReplacement(): string | undefined {
    return this.brand.prompt?.replace;
  }

  /**
   * Get bundled MCP server configs.
   */
  getMcpServers(): Record<string, import('@mimi/core').McpServerConfig> {
    return this.brand.mcpServers ?? {};
  }

  /**
   * Get the product name.
   */
  getName(): string {
    return this.brand.name;
  }

  /**
   * Get the welcome message.
   */
  getWelcomeMessage(): string {
    return this.brand.welcomeMessage ?? `Welcome to ${this.brand.name}!`;
  }

  /**
   * Get the ASCII banner.
   */
  getBanner(): string | undefined {
    return this.brand.banner;
  }
}
