/**
 * @mimi/cli — CLI entry point and orchestration.
 *
 * This is the top-level package that wires all others together.
 */

export { setupContainer } from './container-setup.js';
export type { SetupOptions, SetupResult } from './container-setup.js';

export { Repl } from './repl.js';
export type { ReplOptions } from './repl.js';
export { InkRepl } from './ink-repl.js';

export { AnthropicProvider } from './anthropic-provider.js';
export type { AnthropicProviderConfig } from './anthropic-provider.js';

export { ToolBridge } from './tool-bridge.js';
export type { ToolBridgeConfig } from './tool-bridge.js';

export { loadConfig, loadProjectInstructions, loadMcpServers } from './config.js';
