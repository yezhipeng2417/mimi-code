/**
 * @mimi/permissions — Permission engine and path matching.
 *
 * Depends on: @mimi/core
 */

export { PermissionEngine } from './engine.js';
export type { PermissionStore, PermissionEngineConfig } from './engine.js';

export { matchPath, matchCommand } from './path-matcher.js';
