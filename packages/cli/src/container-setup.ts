/**
 * DI Container setup — wires all packages together.
 */

import {
  ServiceContainer,
  Tokens,
  EventBus,
  ResourceManager,
  MemoryMonitor,
  PromptAssembler,
  SessionStore,
} from '@mimi/core';
import type { MimiConfig } from '@mimi/core';
import { ToolRegistry, ToolExecutor, getBuiltinTools, createToolSearchTool, createSpawnAgentTool, createAskUserTool } from '@mimi/tools';
import { PermissionEngine } from '@mimi/permissions';
import type { PermissionStore } from '@mimi/permissions';
import { McpClient, adaptMcpTools } from '@mimi/mcp';
import { HookRunner } from '@mimi/hooks';
import { SkillLoader, SkillRunner } from '@mimi/skills';
import { AgentOrchestrator } from '@mimi/agents';
import { BrandLoader } from '@mimi/brand';
import type { BrandConfig } from '@mimi/brand';

import { loadConfig, loadProjectInstructions, loadMcpServers, loadHooks } from './config.js';

export interface SetupOptions {
  projectPath: string;
  cliFlags?: Partial<MimiConfig>;
  brandPath?: string;
}

export interface SetupResult {
  container: ServiceContainer;
  config: MimiConfig;
  brand: BrandConfig;
  eventBus: EventBus;
  toolRegistry: ToolRegistry;
  toolExecutor: ToolExecutor;
  permissionEngine: PermissionEngine;
  mcpClient: McpClient;
  hookRunner: HookRunner;
  skillLoader: SkillLoader;
  skillRunner: SkillRunner;
  agentOrchestrator: AgentOrchestrator;
  promptAssembler: PromptAssembler;
  sessionStore: SessionStore;
}

export async function setupContainer(options: SetupOptions): Promise<SetupResult> {
  const { projectPath, cliFlags, brandPath } = options;

  // ── 1. Load config and brand ──────────────────────────────────────

  const config = await loadConfig({ cliFlags, projectPath });

  const brandLoader = new BrandLoader();
  const brand = await brandLoader.load({
    explicitPath: brandPath,
    projectPath,
  });

  // Apply brand defaults
  if (brand.defaultModel && !cliFlags?.model) {
    config.model = brand.defaultModel;
  }
  if (brand.defaultMaxTokens && !cliFlags?.maxTokens) {
    config.maxTokens = brand.defaultMaxTokens;
  }

  // ── 2. Core services ──────────────────────────────────────────────

  const container = new ServiceContainer();
  const eventBus = new EventBus();
  const resourceManager = new ResourceManager();
  const memoryMonitor = new MemoryMonitor();

  container.registerValue(Tokens.EventBus, eventBus);
  container.registerValue(Tokens.ResourceManager, resourceManager);
  container.registerValue(Tokens.MemoryMonitor, memoryMonitor);

  // ── 3. Session store ──────────────────────────────────────────────

  const sessionStore = SessionStore.forProject(projectPath);

  // ── 4. Permission engine ──────────────────────────────────────────

  const permissionStore: PermissionStore = {
    getPermission: (pp, tn, p) => sessionStore.getPermission(pp, tn, p),
    savePermission: (pp, tn, d, p, e) => sessionStore.savePermission(pp, tn, d, p, e),
    clearPermissions: (pp) => sessionStore.clearPermissions(pp),
  };

  const permissionRules = [
    ...(config.permissions ?? []),
    ...(brand.permissions ?? []),
  ];

  const permissionEngine = new PermissionEngine({
    projectPath,
    rules: permissionRules,
    store: permissionStore,
  });

  // ── 5. Tool registry ──────────────────────────────────────────────

  const toolRegistry = new ToolRegistry();
  const toolExecutor = new ToolExecutor({ eventBus });

  // Register built-in tools
  for (const tool of getBuiltinTools()) {
    toolRegistry.registerTool(tool);
  }

  // Register ToolSearch
  toolRegistry.registerTool(createToolSearchTool(toolRegistry));

  // ── 6. MCP client ─────────────────────────────────────────────────

  const mcpClient = new McpClient();

  // Register servers from config + brand
  const mcpServers = await loadMcpServers(projectPath);
  const brandMcpServers = brandLoader.getMcpServers();

  for (const [name, serverConfig] of Object.entries({ ...mcpServers, ...brandMcpServers })) {
    mcpClient.registerServer(name, serverConfig);
  }

  // Connect to MCP servers (parallel)
  const mcpResults = await mcpClient.connectAll();

  // Register MCP tools in registry
  for (const [serverName, tools] of mcpResults) {
    const adapted = adaptMcpTools(mcpClient, serverName, tools);
    for (const tool of adapted) {
      toolRegistry.registerTool(tool as Parameters<typeof toolRegistry.registerTool>[0]);
    }
  }

  // Note: tool registry freeze is deferred until after orchestrator setup (SpawnAgent needs it)

  // ── 7. Hooks ──────────────────────────────────────────────────────

  // Load hooks from config files
  const hookConfigs = await loadHooks(projectPath);
  const hookRunner = new HookRunner(
    hookConfigs.map((h) => ({
      event: h.event as import('@mimi/core').HookEvent,
      command: h.command,
      toolName: h.toolName,
      timeout: h.timeout,
      blocking: h.blocking,
    })),
    eventBus,
  );

  // ── 8. Skills ─────────────────────────────────────────────────────

  const skillLoader = new SkillLoader();
  await skillLoader.loadAll(projectPath, {
    brandSkillsDir: brand.skillsDir,
  });
  const skillRunner = new SkillRunner(skillLoader);
  skillRunner.setContext({
    cwd: projectPath,
    model: config.model,
    projectPath,
  });

  // ── 9. Agent orchestrator ─────────────────────────────────────────

  const agentOrchestrator = new AgentOrchestrator(eventBus);

  // Register factory-created tools and freeze registry
  toolRegistry.registerTool(createSpawnAgentTool(agentOrchestrator));
  toolRegistry.registerTool(createAskUserTool(async (questions) => {
    // Default implementation: returns empty answers
    // The REPL overrides this with actual user input handling
    const answers: Record<string, string> = {};
    for (const q of questions) {
      answers[q.question] = q.options?.[0]?.label ?? '(no answer)';
    }
    return answers;
  }));
  toolRegistry.freeze();

  // ── 10. Prompt assembler ──────────────────────────────────────────

  const coreSystemPrompt = brand.prompt?.replace ?? buildDefaultSystemPrompt(brand.name);

  const promptAssembler = new PromptAssembler({
    coreSystemPrompt,
    brandPrepend: brandLoader.getPromptPrepend(),
    brandAppend: brandLoader.getPromptAppend(),
    defaultModel: config.model,
    defaultMaxTokens: config.maxTokens,
    temperature: config.temperature,
  });

  // Load project instructions
  const instructions = await loadProjectInstructions(projectPath);
  if (instructions) {
    // Collect MCP server instructions
    const mcpInstructions = [...mcpClient.getServerInstructions()]
      .map(([name, inst]) => `## ${name}\n${inst}`)
      .join('\n\n');

    promptAssembler.setProjectConfig({
      instructions,
      mcpInstructions: mcpInstructions || undefined,
    });
  }

  // Freeze tools in assembler
  const toolSchemas = await toolRegistry.listToolSchemas();
  promptAssembler.freezeTools(toolSchemas);

  // ── Done ──────────────────────────────────────────────────────────

  return {
    container,
    config,
    brand,
    eventBus,
    toolRegistry,
    toolExecutor,
    permissionEngine,
    mcpClient,
    hookRunner,
    skillLoader,
    skillRunner,
    agentOrchestrator,
    promptAssembler,
    sessionStore,
  };
}

function buildDefaultSystemPrompt(productName: string): string {
  return `You are ${productName}, an interactive CLI agent that helps users with software engineering tasks.

You have access to tools for reading, writing, and searching files, executing commands, and more.
Use the tools available to assist the user with their requests.

Key behaviors:
- Read files before modifying them
- Prefer editing existing files over creating new ones
- Keep solutions simple and focused
- Be concise in responses
- Use tools when available instead of shell commands`;
}
