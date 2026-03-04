/**
 * Brand JSON schema validation using Zod.
 *
 * Validates brand.json files at load time to catch configuration errors early.
 */

import { z } from 'zod';

export const brandPromptSchema = z.object({
  prepend: z.string().optional().describe('Text prepended to the system prompt'),
  append: z.string().optional().describe('Text appended to the system prompt'),
  replace: z.string().optional().describe('Full system prompt replacement'),
}).strict().optional();

export const brandThemeSchema = z.object({
  name: z.string().optional(),
  colors: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    success: z.string().optional(),
    warning: z.string().optional(),
    error: z.string().optional(),
    muted: z.string().optional(),
    userText: z.string().optional(),
    assistantText: z.string().optional(),
    toolName: z.string().optional(),
    code: z.string().optional(),
  }).partial().optional(),
  symbols: z.object({
    prompt: z.string().optional(),
    success: z.string().optional(),
    error: z.string().optional(),
    warning: z.string().optional(),
    arrow: z.string().optional(),
    bullet: z.string().optional(),
  }).partial().optional(),
}).strict().optional();

export const brandPermissionSchema = z.object({
  tool: z.string(),
  pattern: z.string().optional(),
  decision: z.enum(['allow', 'deny']),
});

export const mcpServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
}).passthrough();

export const brandConfigSchema = z.object({
  name: z.string().min(1, 'Brand name is required'),
  version: z.string().optional(),
  description: z.string().optional(),
  prompt: brandPromptSchema,
  theme: brandThemeSchema,
  mcpServers: z.record(mcpServerSchema).optional(),
  skillsDir: z.string().optional(),
  defaultModel: z.string().optional(),
  defaultMaxTokens: z.number().int().positive().optional(),
  permissions: z.array(brandPermissionSchema).optional(),
  banner: z.string().optional(),
  welcomeMessage: z.string().optional(),
}).strict();

export type ValidatedBrandConfig = z.infer<typeof brandConfigSchema>;

/**
 * Validate a parsed brand.json object.
 * Returns the validated config or throws with descriptive errors.
 */
export function validateBrandConfig(data: unknown): ValidatedBrandConfig {
  return brandConfigSchema.parse(data);
}
