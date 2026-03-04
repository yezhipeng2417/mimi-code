/**
 * @mimi/cli — CLI entry point and orchestration.
 *
 * This is the top-level package that wires all others together.
 */

export { setupContainer } from './container-setup.js';
export type { SetupOptions, SetupResult } from './container-setup.js';

export { Repl } from './repl.js';

export { loadConfig, loadProjectInstructions, loadMcpServers } from './config.js';
