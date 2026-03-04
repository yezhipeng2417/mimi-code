/**
 * Brand configuration types for white-label distribution.
 *
 * A brand.json file customizes the Mimi CLI into a white-label product.
 */

import type { McpServerConfig } from '@mimi/core';

/**
 * Complete brand configuration.
 */
export interface BrandConfig {
  /** Product name (e.g., "AcmeCLI") */
  name: string;

  /** Version string */
  version?: string;

  /** Short description */
  description?: string;

  /** System prompt customization */
  prompt?: BrandPromptConfig;

  /** Theme overrides */
  theme?: BrandThemeConfig;

  /** Bundled MCP servers */
  mcpServers?: Record<string, McpServerConfig>;

  /** Bundled skills directory */
  skillsDir?: string;

  /** Default model */
  defaultModel?: string;

  /** Default max tokens */
  defaultMaxTokens?: number;

  /** Permission rules */
  permissions?: BrandPermissionConfig[];

  /** ASCII art banner (replaces default Mimi parrot) */
  banner?: string;

  /** Welcome message */
  welcomeMessage?: string;
}

/**
 * Prompt layer configuration.
 */
export interface BrandPromptConfig {
  /** Text prepended to the system prompt */
  prepend?: string;

  /** Text appended to the system prompt */
  append?: string;

  /** Full system prompt replacement (use with caution) */
  replace?: string;
}

/**
 * Theme override configuration.
 */
export interface BrandThemeConfig {
  name?: string;
  colors?: Partial<{
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    muted: string;
    userText: string;
    assistantText: string;
    toolName: string;
    code: string;
  }>;
  symbols?: Partial<{
    prompt: string;
    success: string;
    error: string;
    warning: string;
    arrow: string;
    bullet: string;
  }>;
}

/**
 * Brand permission rule.
 */
export interface BrandPermissionConfig {
  tool: string;
  pattern?: string;
  decision: 'allow' | 'deny';
}
