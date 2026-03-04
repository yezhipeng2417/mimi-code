/**
 * SkillRunner — Executes skills by expanding their prompt templates.
 */

import type { SkillRunResult } from './types.js';
import type { SkillLoader } from './loader.js';

export class SkillRunner {
  constructor(private loader: SkillLoader) {}

  /**
   * Run a skill by name with optional arguments.
   */
  run(skillName: string, args?: string): SkillRunResult | undefined {
    const skill = this.loader.getSkill(skillName);
    if (!skill) return undefined;

    const expandedPrompt = this.expandTemplate(skill.prompt, args);

    return {
      expandedPrompt,
      metadata: {
        skillName: skill.name,
        source: skill.source,
        args,
      },
    };
  }

  /**
   * Expand a skill's prompt template with arguments.
   *
   * Supported interpolations:
   *   {{args}} — the raw arguments string
   *   {{ARGUMENTS}} — same as {{args}}
   */
  private expandTemplate(template: string, args?: string): string {
    let result = template;

    if (args) {
      result = result.replace(/\{\{args\}\}/gi, args);
      result = result.replace(/\{\{ARGUMENTS\}\}/g, args);
    } else {
      result = result.replace(/\{\{args\}\}/gi, '');
      result = result.replace(/\{\{ARGUMENTS\}\}/g, '');
    }

    return result.trim();
  }
}
