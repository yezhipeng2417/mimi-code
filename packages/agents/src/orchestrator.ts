/**
 * AgentOrchestrator — Manages sub-agent spawning, tracking, and results.
 *
 * Sub-agents get:
 *   - Filtered ToolRegistry (only allowed tools)
 *   - Separate AgentLoop instance
 *   - Optionally isolated git worktree
 */

import { randomUUID } from 'node:crypto';
import type { EventBusLike } from '@mimi/core';
import type { ActiveAgent, AgentResult, AgentTypeConfig, SpawnRequest } from './types.js';

/**
 * Default agent types matching Claude Code's agent system.
 */
export const DEFAULT_AGENT_TYPES: AgentTypeConfig[] = [
  {
    name: 'general-purpose',
    description: 'General-purpose agent for complex, multi-step tasks',
    systemPrompt: 'You are a general-purpose agent. Complete the assigned task thoroughly.',
    allowedTools: ['*'],
    maxTurns: 30,
  },
  {
    name: 'Explore',
    description: 'Fast agent for codebase exploration',
    systemPrompt: 'You are a fast exploration agent. Search and analyze code efficiently. Do not modify files.',
    allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
    maxTurns: 15,
  },
  {
    name: 'Plan',
    description: 'Architect agent for designing implementation plans',
    systemPrompt: 'You are a planning agent. Design implementation strategies and identify critical files.',
    allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
    maxTurns: 20,
  },
];

export class AgentOrchestrator {
  private agentTypes = new Map<string, AgentTypeConfig>();
  private activeAgents = new Map<string, ActiveAgent>();
  private eventBus?: EventBusLike;

  constructor(eventBus?: EventBusLike) {
    this.eventBus = eventBus;

    // Register default agent types
    for (const type of DEFAULT_AGENT_TYPES) {
      this.agentTypes.set(type.name, type);
    }
  }

  /**
   * Register a custom agent type.
   */
  registerAgentType(config: AgentTypeConfig): void {
    this.agentTypes.set(config.name, config);
  }

  /**
   * Spawn a sub-agent.
   *
   * Note: Actual AgentLoop creation is handled by the CLI layer
   * which has access to the full DI container. This class manages
   * the orchestration lifecycle.
   */
  async spawn(request: SpawnRequest): Promise<string> {
    const typeConfig = this.agentTypes.get(request.type);
    if (!typeConfig) {
      throw new Error(
        `Unknown agent type: "${request.type}". ` +
          `Available: ${[...this.agentTypes.keys()].join(', ')}`,
      );
    }

    const agentId = randomUUID();

    const agent: ActiveAgent = {
      id: agentId,
      type: request.type,
      prompt: request.prompt,
      status: 'running',
      startedAt: Date.now(),
    };

    this.activeAgents.set(agentId, agent);

    this.eventBus?.emit('agent:state_change', {
      from: 'IDLE',
      to: 'ASSEMBLING',
    });

    return agentId;
  }

  /**
   * Report agent completion.
   */
  completeAgent(agentId: string, result: AgentResult): void {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    agent.status = result.success ? 'completed' : 'failed';
    agent.result = result;
  }

  /**
   * Cancel an agent.
   */
  cancelAgent(agentId: string): void {
    const agent = this.activeAgents.get(agentId);
    if (!agent || agent.status !== 'running') return;

    agent.status = 'cancelled';
    agent.result = {
      agentId,
      type: agent.type,
      response: 'Agent was cancelled.',
      success: false,
      totalTokens: 0,
      durationMs: Date.now() - agent.startedAt,
    };
  }

  /**
   * Get agent type config.
   */
  getAgentType(name: string): AgentTypeConfig | undefined {
    return this.agentTypes.get(name);
  }

  /**
   * List registered agent types.
   */
  listAgentTypes(): AgentTypeConfig[] {
    return [...this.agentTypes.values()];
  }

  /**
   * Get active agent by ID.
   */
  getAgent(agentId: string): ActiveAgent | undefined {
    return this.activeAgents.get(agentId);
  }

  /**
   * List all active agents.
   */
  listActiveAgents(): ActiveAgent[] {
    return [...this.activeAgents.values()].filter((a) => a.status === 'running');
  }

  /**
   * Clean up completed agents.
   */
  cleanup(): void {
    for (const [id, agent] of this.activeAgents) {
      if (agent.status !== 'running') {
        this.activeAgents.delete(id);
      }
    }
  }

  /**
   * Get all agent types (for tool listing).
   */
  getAgentTypeNames(): string[] {
    return [...this.agentTypes.keys()];
  }
}
