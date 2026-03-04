/**
 * Built-in theme definitions.
 */

import type { Theme } from '../theme.js';

/** Minimal dark theme for low-contrast terminals */
const darkTheme: Theme = {
  name: 'dark',
  colors: {
    primary: '#A78BFA',
    secondary: '#818CF8',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    muted: '#4B5563',
    userText: '#D1D5DB',
    assistantText: '#E5E7EB',
    toolName: '#60A5FA',
    code: '#A7F3D0',
  },
  symbols: {
    prompt: '❯',
    spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    success: '✓',
    error: '✗',
    warning: '⚠',
    arrow: '→',
    bullet: '•',
  },
};

/** Light theme for light terminal backgrounds */
const lightTheme: Theme = {
  name: 'light',
  colors: {
    primary: '#7C3AED',
    secondary: '#4F46E5',
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
    muted: '#9CA3AF',
    userText: '#374151',
    assistantText: '#1F2937',
    toolName: '#2563EB',
    code: '#047857',
  },
  symbols: {
    prompt: '❯',
    spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    success: '✓',
    error: '✗',
    warning: '⚠',
    arrow: '→',
    bullet: '•',
  },
};

/** Monochrome ASCII-safe theme (no Unicode) */
const monoTheme: Theme = {
  name: 'mono',
  colors: {
    primary: '#FFFFFF',
    secondary: '#CCCCCC',
    success: '#FFFFFF',
    warning: '#FFFFFF',
    error: '#FFFFFF',
    muted: '#666666',
    userText: '#FFFFFF',
    assistantText: '#FFFFFF',
    toolName: '#CCCCCC',
    code: '#FFFFFF',
  },
  symbols: {
    prompt: '>',
    spinner: ['-', '\\', '|', '/'],
    success: '+',
    error: 'x',
    warning: '!',
    arrow: '->',
    bullet: '*',
  },
};

export const builtinThemes = new Map<string, Theme>([
  ['dark', darkTheme],
  ['light', lightTheme],
  ['mono', monoTheme],
]);
