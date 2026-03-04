// @mimi/core — Foundation layer
// Zero internal dependencies. Everything else depends on this.

// Types
export type {
  // Messages
  Role,
  Message,
  MessageMetadata,
  ContentBlock,
  TextBlock,
  ImageBlock,
  ToolUseBlock,
  ToolResultBlock,
  ToolResultContent,
  ThinkingBlock,
  Citation,
  // System
  SystemBlock,
  CacheHint,
  // Provider
  ProviderFeatures,
  MessageParams,
  ModelInfo,
  JsonSchema,
  ToolSchema,
  // Streaming
  StreamEvent,
  ContentDelta,
  StopReason,
  UsageInfo,
  // Tools
  ToolSource,
  ToolResult,
  ToolContext,
  PermissionChecker,
  PermissionDecision,
  EventBusLike,
  ResourceManagerLike,
  // Hooks
  HookEvent,
  HookResult,
  // Session
  SessionInfo,
  // Agent
  AgentState,
  // Cache
  CacheMetrics,
  // Config
  MimiConfig,
  McpServerConfig,
  PermissionRuleConfig,
} from './types.js';

// DI Container
export { ServiceContainer, createToken } from './container.js';
export type { Token } from './container.js';

// EventBus
export { EventBus } from './event-bus.js';
export type { EventMap } from './event-bus.js';

// Resource Management
export {
  ResourceManager,
  TempFileRegistry,
  ChildProcessTracker,
  BoundedCache,
  MemoryMonitor,
} from './resource-manager.js';

// Prompt Assembler
export { PromptAssembler } from './prompt-assembler.js';
export type {
  PromptAssemblerConfig,
  ProjectConfig,
  SystemReminder,
  AssembledRequest,
} from './prompt-assembler.js';

// Session Store
export { SessionStore } from './session-store.js';

// Provider
export type { LLMProvider } from './provider.js';
export { StreamNormalizer } from './provider.js';

// Agent Loop
export { AgentLoop } from './agent-loop.js';
export type { ToolExecutor, PermissionPrompt, HookRunnerLike, AgentLoopConfig } from './agent-loop.js';

// DI Tokens
export { Tokens } from './tokens.js';
