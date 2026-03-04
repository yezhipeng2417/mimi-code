/**
 * Agent orchestration types.
 */

/**
 * Agent type definitions — each type has specific capabilities and tool access.
 */
export interface AgentTypeConfig {
  /** Agent type name */
  name: string;

  /** Description of the agent's purpose */
  description: string;

  /** System prompt for this agent type */
  systemPrompt: string;

  /** Allowed tools for this agent type */
  allowedTools: string[];

  /** Default model override */
  model?: string;

  /** Maximum turns before auto-stop */
  maxTurns?: number;

  /** Whether this agent runs in an isolated worktree */
  isolation?: 'none' | 'worktree';
}

/**
 * Request to spawn a sub-agent.
 */
export interface SpawnRequest {
  /** Agent type (e.g., "general-purpose", "Explore", "Plan") */
  type: string;

  /** Task description for the agent */
  prompt: string;

  /** Optional model override */
  model?: string;

  /** Maximum turns */
  maxTurns?: number;

  /** Run in background */
  background?: boolean;

  /** Isolation mode */
  isolation?: 'none' | 'worktree';
}

/**
 * Result from a completed sub-agent.
 */
export interface AgentResult {
  /** Agent ID */
  agentId: string;

  /** Agent type */
  type: string;

  /** Final response text */
  response: string;

  /** Whether the agent completed successfully */
  success: boolean;

  /** Total tokens used */
  totalTokens: number;

  /** Duration in ms */
  durationMs: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Active agent state for tracking.
 */
export interface ActiveAgent {
  id: string;
  type: string;
  prompt: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  result?: AgentResult;
}
