/**
 * SpawnAgent tool — Spawns sub-agents for complex, multi-step tasks.
 *
 * The LLM calls this tool to delegate work to a specialized sub-agent
 * that runs in its own AgentLoop with filtered tools.
 */

import { z } from 'zod';
import type { ToolContext, ToolResult } from '@mimi/core';
import type { Tool } from '../types.js';

const inputSchema = z.object({
  description: z.string().describe('Short (3-5 word) description of the task'),
  prompt: z.string().describe('Detailed task description for the sub-agent'),
  subagent_type: z.string().default('general-purpose').describe(
    'Agent type: "general-purpose", "Explore", "Plan"',
  ),
  model: z.string().optional().describe('Optional model override for the sub-agent'),
  max_turns: z.number().int().positive().optional().describe('Maximum turns before stopping'),
  run_in_background: z.boolean().optional().describe('Run agent in background'),
});

/**
 * Factory: creates a SpawnAgent tool bound to an AgentOrchestrator.
 */
export function createSpawnAgentTool(orchestrator: {
  spawn(request: {
    type: string;
    prompt: string;
    model?: string;
    maxTurns?: number;
    background?: boolean;
  }): Promise<string>;
  getAgent(id: string): { status: string; result?: { response: string; success: boolean; durationMs: number } } | undefined;
}): Tool {
  return {
    name: 'Agent',
    description:
      'Launch a specialized sub-agent to handle complex, multi-step tasks autonomously. ' +
      'Available types: "general-purpose" (all tools), "Explore" (read-only codebase search), "Plan" (architecture design).',
    source: 'builtin',
    category: 'orchestration',
    inputSchema,

    collapsedSummary(input: unknown) {
      const parsed = input as z.infer<typeof inputSchema>;
      return `${parsed.subagent_type}: ${parsed.description}`;
    },

    async execute(input: unknown, _ctx: ToolContext): Promise<ToolResult> {
      const parsed = inputSchema.parse(input);

      try {
        const agentId = await orchestrator.spawn({
          type: parsed.subagent_type,
          prompt: parsed.prompt,
          model: parsed.model,
          maxTurns: parsed.max_turns,
          background: parsed.run_in_background,
        });

        // For foreground agents, the spawn() call waits for completion
        if (!parsed.run_in_background) {
          const agent = orchestrator.getAgent(agentId);
          if (agent?.result) {
            return {
              content: [{
                type: 'text',
                text: agent.result.response,
              }],
              isError: !agent.result.success,
            };
          }
        }

        // Background agent — return the ID for later retrieval
        return {
          content: [{
            type: 'text',
            text: `Agent spawned in background (id: ${agentId.slice(0, 8)}...). ` +
                  `Type: ${parsed.subagent_type}. Task: ${parsed.description}`,
          }],
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Failed to spawn agent: ${errMsg}` }],
          isError: true,
        };
      }
    },
  };
}
