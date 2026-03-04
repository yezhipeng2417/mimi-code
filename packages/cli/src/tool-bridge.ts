/**
 * ToolBridge — Adapts @mimi/tools ToolRegistry + ToolExecutor
 * to the AgentLoop's ToolExecutor interface from @mimi/core.
 *
 * Also bridges PermissionEngine for hasPermission checks.
 */

import type { ToolResult, ToolContext, EventBusLike, ResourceManagerLike } from '@mimi/core';
import type { ToolExecutor as AgentToolExecutor } from '@mimi/core';
import type { ToolRegistry, ToolExecutor } from '@mimi/tools';
import type { PermissionEngine } from '@mimi/permissions';

export interface ToolBridgeConfig {
  registry: ToolRegistry;
  executor: ToolExecutor;
  permissionEngine: PermissionEngine;
  eventBus: EventBusLike;
  resourceManager: ResourceManagerLike;
  workingDirectory: string;
  sessionId: string;
}

export class ToolBridge implements AgentToolExecutor {
  private config: ToolBridgeConfig;

  constructor(config: ToolBridgeConfig) {
    this.config = config;
  }

  async execute(toolName: string, input: unknown, abortSignal: AbortSignal): Promise<ToolResult> {
    const tool = await this.config.registry.getTool(toolName);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }

    const ctx: ToolContext = {
      sessionId: this.config.sessionId,
      workingDirectory: this.config.workingDirectory,
      abortSignal,
      permissions: this.config.permissionEngine,
      eventBus: this.config.eventBus,
      resourceManager: this.config.resourceManager,
    };

    return this.config.executor.execute(tool, input, ctx);
  }

  async hasPermission(toolName: string, input: unknown): Promise<{ decision: 'allow' | 'deny' | 'ask' }> {
    const result = await this.config.permissionEngine.check(toolName, input);
    return { decision: result.decision };
  }
}
