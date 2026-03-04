/**
 * SkillRunner — Executes skills by expanding their prompt templates.
 */

import type { SkillRunResult } from './types.js';
import type { SkillLoader } from './loader.js';

export interface SkillRunnerContext {
  cwd?: string;
  model?: string;
  projectPath?: string;
}

export class SkillRunner {
  private context: SkillRunnerContext = {};

  constructor(private loader: SkillLoader) {}

  /**
   * Set runtime context for template variable substitution.
   */
  setContext(context: SkillRunnerContext): void {
    this.context = { ...this.context, ...context };
  }

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
   * Expand a skill's prompt template with arguments and context variables.
   *
   * Supported interpolations:
   *   {{args}} / {{ARGUMENTS}} — the raw arguments string
   *   {{cwd}} — current working directory
   *   {{date}} — current date (ISO format)
   *   {{model}} — active model name
   *   {{project}} — project path
   */
  private expandTemplate(template: string, args?: string): string {
    let result = template;

    // Arguments
    const argsValue = args ?? '';
    result = result.replace(/\{\{args\}\}/gi, argsValue);
    result = result.replace(/\{\{ARGUMENTS\}\}/g, argsValue);

    // Context variables
    result = result.replace(/\{\{cwd\}\}/g, this.context.cwd ?? process.cwd());
    result = result.replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10));
    result = result.replace(/\{\{model\}\}/g, this.context.model ?? 'unknown');
    result = result.replace(/\{\{project\}\}/g, this.context.projectPath ?? process.cwd());

    return result.trim();
  }
}
