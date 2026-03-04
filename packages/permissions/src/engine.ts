/**
 * PermissionEngine — Rule-based and persistent permission checking.
 *
 * Evaluation order:
 *   1. Config rules (from MIMI.md / settings) — highest priority
 *   2. Persistent rules (from SessionStore) — "always allow" decisions
 *   3. Session rules (in-memory, current session only)
 *   4. Default → 'ask' (prompt user)
 */

import type { PermissionChecker, PermissionDecision, PermissionRuleConfig } from '@mimi/core';
import { matchCommand, matchPath } from './path-matcher.js';

/**
 * Backend for persistent permission storage.
 */
export interface PermissionStore {
  getPermission(
    projectPath: string,
    toolName: string,
    pattern?: string,
  ): PermissionDecision | undefined;

  savePermission(
    projectPath: string,
    toolName: string,
    decision: 'allow' | 'deny',
    pattern?: string,
    expiresAt?: number,
  ): void;

  clearPermissions(projectPath: string): void;
}

export interface PermissionEngineConfig {
  /** Project path for scoping rules */
  projectPath: string;

  /** Static rules from config (highest priority) */
  rules?: PermissionRuleConfig[];

  /** Persistent store (SessionStore) */
  store?: PermissionStore;
}

/**
 * In-memory session rule.
 */
interface SessionRule {
  toolName: string;
  pattern?: string;
  decision: 'allow' | 'deny';
}

export class PermissionEngine implements PermissionChecker {
  private projectPath: string;
  private configRules: PermissionRuleConfig[];
  private store?: PermissionStore;
  private sessionRules: SessionRule[] = [];

  constructor(config: PermissionEngineConfig) {
    this.projectPath = config.projectPath;
    this.configRules = config.rules ?? [];
    this.store = config.store;
  }

  /**
   * Check permission for a tool + input combination.
   */
  async check(toolName: string, input: unknown): Promise<PermissionDecision> {
    const extractedPath = this.extractPath(toolName, input);

    // 1. Check config rules (highest priority)
    const configResult = this.checkConfigRules(toolName, extractedPath);
    if (configResult) return configResult;

    // 2. Check persistent rules (from store)
    if (this.store) {
      const persistent = this.store.getPermission(
        this.projectPath,
        toolName,
        extractedPath,
      );
      if (persistent) return persistent;
    }

    // 3. Check session rules (in-memory)
    const sessionResult = this.checkSessionRules(toolName, extractedPath);
    if (sessionResult) return sessionResult;

    // 4. Default: ask user
    return { decision: 'ask' };
  }

  /**
   * Add a session-scoped rule (in-memory, current session only).
   */
  addSessionRule(
    toolName: string,
    decision: 'allow' | 'deny',
    pattern?: string,
  ): void {
    this.sessionRules.push({ toolName, pattern, decision });
  }

  /**
   * Save a persistent rule (survives sessions).
   */
  savePersistentRule(
    toolName: string,
    decision: 'allow' | 'deny',
    pattern?: string,
    expiresAt?: number,
  ): void {
    this.store?.savePermission(
      this.projectPath,
      toolName,
      decision,
      pattern,
      expiresAt,
    );
  }

  /**
   * Clear all persistent rules for this project.
   */
  clearPersistentRules(): void {
    this.store?.clearPermissions(this.projectPath);
  }

  /**
   * Clear session rules.
   */
  clearSessionRules(): void {
    this.sessionRules = [];
  }

  // ── Private ─────────────────────────────────────────────────────────

  private checkConfigRules(
    toolName: string,
    filePath?: string,
  ): PermissionDecision | undefined {
    for (const rule of this.configRules) {
      if (!this.matchToolName(rule.tool, toolName)) continue;

      if (rule.pattern && filePath) {
        if (matchPath(rule.pattern, filePath)) {
          return rule.decision === 'allow'
            ? { decision: 'allow', source: 'rule' }
            : { decision: 'deny', reason: `Denied by config rule: ${rule.tool} ${rule.pattern}` };
        }
      } else if (!rule.pattern) {
        return rule.decision === 'allow'
          ? { decision: 'allow', source: 'rule' }
          : { decision: 'deny', reason: `Denied by config rule: ${rule.tool}` };
      }
    }
    return undefined;
  }

  private checkSessionRules(
    toolName: string,
    filePath?: string,
  ): PermissionDecision | undefined {
    // Check in reverse order (most recent first)
    for (let i = this.sessionRules.length - 1; i >= 0; i--) {
      const rule = this.sessionRules[i]!;

      if (!this.matchToolName(rule.toolName, toolName)) continue;

      if (rule.pattern && filePath) {
        if (matchPath(rule.pattern, filePath) || matchCommand(rule.pattern, filePath)) {
          return rule.decision === 'allow'
            ? { decision: 'allow', source: 'user' }
            : { decision: 'deny', reason: 'Denied by session rule' };
        }
      } else if (!rule.pattern) {
        return rule.decision === 'allow'
          ? { decision: 'allow', source: 'user' }
          : { decision: 'deny', reason: 'Denied by session rule' };
      }
    }
    return undefined;
  }

  /**
   * Match tool name (supports wildcards).
   */
  private matchToolName(pattern: string, toolName: string): boolean {
    if (pattern === '*') return true;
    if (pattern === toolName) return true;
    // Prefix matching: "mcp__*" matches "mcp__github__create_issue"
    if (pattern.endsWith('*')) {
      return toolName.startsWith(pattern.slice(0, -1));
    }
    return false;
  }

  /**
   * Extract file path or command from tool input for pattern matching.
   */
  private extractPath(toolName: string, input: unknown): string | undefined {
    if (!input || typeof input !== 'object') return undefined;

    const obj = input as Record<string, unknown>;

    // File-based tools
    if (typeof obj['file_path'] === 'string') return obj['file_path'] as string;
    if (typeof obj['filePath'] === 'string') return obj['filePath'] as string;
    if (typeof obj['path'] === 'string') return obj['path'] as string;
    if (typeof obj['notebook_path'] === 'string') return obj['notebook_path'] as string;

    // Bash tool — extract command
    if (toolName === 'Bash' && typeof obj['command'] === 'string') {
      return obj['command'] as string;
    }

    return undefined;
  }
}
