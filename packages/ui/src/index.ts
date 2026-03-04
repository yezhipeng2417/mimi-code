/**
 * @mimi/ui — Ink 5 + React TUI components.
 *
 * Depends on: @mimi/core, ink, react
 */

// Theme
export { defaultTheme, createTheme } from './theme.js';
export type { Theme } from './theme.js';

// Components
export {
  Spinner,
  ToolStatus,
  MessageBubble,
  PermissionPrompt,
  StatusBar,
  StreamingText,
} from './components/index.js';
