/**
 * Hook system types.
 */

import type { HookEvent, HookResult } from '@mimi/core';

/**
 * Hook configuration — defines when and how hooks fire.
 */
export interface HookConfig {
  /** Which event triggers this hook */
  event: HookEvent;

  /** Shell command to execute */
  command: string;

  /** Optional tool name filter (only fire for specific tools) */
  toolName?: string;

  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;

  /** Whether to block execution on this hook's result */
  blocking?: boolean;
}

/**
 * Hook execution context passed to the command via environment variables.
 */
export interface HookContext {
  /** The event that triggered this hook */
  event: HookEvent;

  /** Session ID */
  sessionId: string;

  /** Working directory */
  workingDirectory: string;

  /** Tool name (if applicable) */
  toolName?: string;

  /** Tool input JSON (if applicable) */
  toolInput?: string;

  /** Tool output JSON (if applicable) */
  toolOutput?: string;
}

/**
 * Result of a hook execution.
 */
export interface HookExecutionResult {
  /** The hook that was executed */
  config: HookConfig;

  /** The hook's result */
  result: HookResult;

  /** Execution duration in ms */
  durationMs: number;

  /** Stdout from the hook command */
  stdout: string;

  /** Stderr from the hook command */
  stderr: string;

  /** Exit code */
  exitCode: number | null;
}
