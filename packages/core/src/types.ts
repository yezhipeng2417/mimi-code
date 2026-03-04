// === Messages ===
export type Role = 'user' | 'assistant';

export interface MessageMetadata {
  anchor?: boolean;
  compactionSummary?: boolean;
  turnIndex?: number;
  timestamp?: number;
}

export interface TextBlock {
  type: 'text';
  text: string;
  citations?: Citation[];
}

export interface Citation {
  type: 'text';
  startIndex: number;
  endIndex: number;
  source: string;
}

export interface ImageBlock {
  type: 'image';
  source:
    | { type: 'base64'; mediaType: string; data: string }
    | { type: 'url'; url: string };
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ToolResultContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; mediaType: string; data: string } };

export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: ToolResultContent[];
  isError?: boolean;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

export type ContentBlock =
  | TextBlock
  | ImageBlock
  | ToolUseBlock
  | ToolResultBlock
  | ThinkingBlock;

export interface Message {
  role: Role;
  content: ContentBlock[];
  metadata?: MessageMetadata;
}

// === System Prompts ===
export interface CacheHint {
  type: 'ephemeral';
}

export type SystemBlock =
  | { type: 'text'; text: string; cacheControl?: CacheHint };

// === Provider Types ===
export interface ProviderFeatures {
  streaming: boolean;
  toolUse: boolean;
  extendedThinking: boolean;
  imageInput: boolean;
  pdfInput: boolean;
  promptCaching: boolean;
}

export interface MessageParams {
  model: string;
  system: SystemBlock[];
  messages: Message[];
  tools?: ToolSchema[];
  maxTokens: number;
  temperature?: number;
  thinking?: { type: 'enabled'; budgetTokens: number };
}

export interface ModelInfo {
  id: string;
  name: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  supportsTools: boolean;
  supportsThinking: boolean;
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  cachedInputPricePerMToken?: number;
}

export type JsonSchema = Record<string, unknown>;

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  cacheControl?: CacheHint;
}

// === Stream Events (normalized across providers) ===
export type StreamEvent =
  | { type: 'message_start'; messageId: string }
  | { type: 'content_block_start'; index: number; contentBlock: ContentBlock }
  | { type: 'content_block_delta'; index: number; delta: ContentDelta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; stopReason: StopReason; usage?: UsageInfo }
  | { type: 'message_stop' };

export type ContentDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'input_json_delta'; partialJson: string };

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

// === Tool Types ===
export type ToolSource = 'builtin' | 'mcp' | 'plugin' | 'skill';

export interface ToolResult {
  content: ToolResultContent[];
  isError?: boolean;
}

export interface ToolContext {
  sessionId: string;
  workingDirectory: string;
  abortSignal: AbortSignal;
  permissions: PermissionChecker;
  eventBus: EventBusLike;
  resourceManager: ResourceManagerLike;
}

// Minimal interfaces to avoid circular deps
export interface PermissionChecker {
  check(toolName: string, input: unknown): Promise<PermissionDecision>;
}

export type PermissionDecision =
  | { decision: 'allow'; source: 'rule' | 'persistent' | 'user' }
  | { decision: 'deny'; reason: string }
  | { decision: 'ask' };

export interface EventBusLike {
  emit(event: string, data?: unknown): void;
}

export interface ResourceManagerLike {
  trackTempFile(path: string): string;
  onCleanup(fn: () => void | Promise<void>): void;
}

// === Hook Types ===
export type HookEvent =
  | 'SessionStart' | 'SessionEnd'
  | 'UserPromptSubmit' | 'Stop'
  | 'PreToolUse' | 'PostToolUse' | 'PostToolUseFailure'
  | 'PermissionRequest' | 'Notification'
  | 'SubagentStart' | 'SubagentStop'
  | 'TaskCompleted' | 'ConfigChange'
  | 'PreCompact';

export interface HookResult {
  action: 'continue' | 'block' | 'modify';
  modifiedInput?: unknown;
  injectedResult?: ToolResult;
  message?: string;
}

// === Session Types ===
export interface SessionInfo {
  id: string;
  projectPath: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  tokenCount: number;
  costUsd: number;
  status: 'active' | 'completed' | 'archived';
}

// === Agent Loop State ===
export type AgentState =
  | 'IDLE'
  | 'ASSEMBLING'
  | 'COMPACTING'
  | 'STREAMING'
  | 'CHECKING_PERM'
  | 'AWAITING_USER'
  | 'EXECUTING_TOOL'
  | 'LOOP_BACK'
  | 'CANCELLED';

// === Cache Metrics ===
export interface CacheMetrics {
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  inputTokens: number;
  cacheHitRate: number;
}

// === Config Types ===
export interface MimiConfig {
  model: string;
  maxTokens: number;
  temperature?: number;
  apiKey?: string;
  provider: 'anthropic' | 'openai' | 'ollama' | 'custom';
  customBaseUrl?: string;
  mcpServers?: Record<string, McpServerConfig>;
  permissions?: PermissionRuleConfig[];
}

export interface McpServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  disabled?: boolean;
  disabledTools?: string[];
}

export interface PermissionRuleConfig {
  tool: string;
  pattern?: string;
  decision: 'allow' | 'deny';
}
