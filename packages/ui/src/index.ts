/**
 * @mimi/ui — Ink 5 + React TUI components.
 *
 * Depends on: @mimi/core, ink, react
 */

// Theme
export { defaultTheme, createTheme } from './theme.js';
export type { Theme } from './theme.js';

// Theme context
export { ThemeProvider, useTheme } from './ThemeContext.js';

// Theme system
export { resolveTheme } from './themes/resolver.js';
export { builtinThemes } from './themes/builtin.js';

// Components
export {
  Spinner,
  ToolStatus,
  MessageBubble,
  PermissionPrompt,
  StatusBar,
  StreamingText,
  InputEditor,
  ToolCallView,
  DiffViewer,
  WelcomeBanner,
  TaskList,
  MimiApp,
} from './components/index.js';

export type {
  MimiAppProps,
  DisplayMessage,
  ToolCallInfo,
  PermissionRequest,
  AppState,
} from './components/index.js';
