/**
 * Skill system types.
 */

/**
 * A skill definition loaded from disk or plugin.
 */
export interface SkillDefinition {
  /** Unique skill name (e.g., "commit", "review-pr") */
  name: string;

  /** Display name for UI */
  displayName: string;

  /** Short description */
  description: string;

  /** Prompt template (supports {{args}} interpolation) */
  prompt: string;

  /** Whether this skill is user-invocable via /command */
  userInvocable: boolean;

  /** Source of the skill */
  source: SkillSource;

  /** Optional: arguments schema description */
  argsDescription?: string;

  /** Optional: fully qualified name (e.g., "plugin:name:skill") */
  fqn?: string;
}

export type SkillSource =
  | { type: 'builtin' }
  | { type: 'project'; path: string }
  | { type: 'plugin'; pluginName: string }
  | { type: 'user'; path: string };

/**
 * Result of running a skill.
 */
export interface SkillRunResult {
  /** The expanded prompt to inject into the conversation */
  expandedPrompt: string;

  /** Metadata about the skill execution */
  metadata: {
    skillName: string;
    source: SkillSource;
    args?: string;
  };
}
