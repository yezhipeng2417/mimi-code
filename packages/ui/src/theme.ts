/**
 * Theme system for Mimi TUI.
 *
 * Defines colors, styles, and layout for the terminal UI.
 * Supports brand overrides via @mimi/brand.
 */

export interface Theme {
  name: string;

  colors: {
    /** Primary accent color */
    primary: string;
    /** Secondary accent */
    secondary: string;
    /** Success/completion */
    success: string;
    /** Warning */
    warning: string;
    /** Error/failure */
    error: string;
    /** Muted/dim text */
    muted: string;
    /** User input text */
    userText: string;
    /** Assistant response text */
    assistantText: string;
    /** Tool name highlight */
    toolName: string;
    /** Code/monospace text */
    code: string;
  };

  symbols: {
    /** Prompt character */
    prompt: string;
    /** Thinking/loading spinner frames */
    spinner: string[];
    /** Success indicator */
    success: string;
    /** Error indicator */
    error: string;
    /** Warning indicator */
    warning: string;
    /** Arrow/pointer */
    arrow: string;
    /** Bullet */
    bullet: string;
  };
}

/**
 * Default Mimi theme — warm yellow tones for the parrot mascot.
 */
export const defaultTheme: Theme = {
  name: 'mimi',

  colors: {
    primary: '#FFD700',      // Gold (parrot yellow)
    secondary: '#4A9EFF',    // Blue
    success: '#4ADE80',      // Green
    warning: '#FBBF24',      // Amber
    error: '#F87171',        // Red
    muted: '#6B7280',        // Gray
    userText: '#E5E7EB',     // Light gray
    assistantText: '#F3F4F6', // White-ish
    toolName: '#A78BFA',     // Purple
    code: '#34D399',         // Emerald
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

/**
 * Create a theme with overrides applied on top of the default.
 */
export function createTheme(overrides: Partial<Theme>): Theme {
  return {
    ...defaultTheme,
    ...overrides,
    colors: { ...defaultTheme.colors, ...(overrides.colors ?? {}) },
    symbols: { ...defaultTheme.symbols, ...(overrides.symbols ?? {}) },
  };
}
