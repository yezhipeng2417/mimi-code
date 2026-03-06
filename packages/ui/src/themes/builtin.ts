/**
 * Built-in theme definitions.
 */

import type { Theme } from '../theme.js';

/** Dark theme for dark terminal backgrounds */
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
    border: '#374151',
    badge: '#4B5563',
    accent2: '#C084FC',
  },
  symbols: {
    prompt: '❯',
    spinner: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
    success: '✔',
    error: '✘',
    warning: '▲',
    arrow: '→',
    bullet: '·',
    hrule: '─',
    userIcon: '●',
    assistantIcon: '◆',
    toolRunning: '⚙',
    vbar: '│',
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
    border: '#D1D5DB',
    badge: '#E5E7EB',
    accent2: '#F59E0B',
  },
  symbols: {
    prompt: '❯',
    spinner: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
    success: '✔',
    error: '✘',
    warning: '▲',
    arrow: '→',
    bullet: '·',
    hrule: '─',
    userIcon: '●',
    assistantIcon: '◆',
    toolRunning: '⚙',
    vbar: '│',
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
    border: '#444444',
    badge: '#555555',
    accent2: '#AAAAAA',
  },
  symbols: {
    prompt: '>',
    spinner: ['-', '\\', '|', '/'],
    success: '+',
    error: 'x',
    warning: '!',
    arrow: '->',
    bullet: '*',
    hrule: '-',
    userIcon: '*',
    assistantIcon: '#',
    toolRunning: '@',
    vbar: '|',
  },
};

export const builtinThemes = new Map<string, Theme>([
  ['dark', darkTheme],
  ['light', lightTheme],
  ['mono', monoTheme],
]);
