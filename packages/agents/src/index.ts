/**
 * @mimi/agents — Sub-agent orchestration.
 *
 * Depends on: @mimi/core, @mimi/tools, @mimi/permissions
 */

export { AgentOrchestrator, DEFAULT_AGENT_TYPES } from './orchestrator.js';
export type {
  AgentTypeConfig,
  SpawnRequest,
  AgentResult,
  ActiveAgent,
} from './types.js';
