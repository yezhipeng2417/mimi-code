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
    /** Divider/border color */
    border: string;
    /** Badge/label background */
    badge: string;
    /** Accent gradient end */
    accent2: string;
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
    /** Horizontal rule character */
    hrule: string;
    /** User role icon */
    userIcon: string;
    /** Assistant role icon */
    assistantIcon: string;
    /** Tool running icon */
    toolRunning: string;
    /** Left border bar */
    vbar: string;
  };
}

/**
 * Default Mimi theme — warm golden tones with modern styling.
 */
export const defaultTheme: Theme = {
  name: 'mimi',

  colors: {
    primary: '#FFD700',       // Gold (parrot yellow)
    secondary: '#79C0FF',     // Sky blue
    success: '#7EE787',       // Soft green
    warning: '#F0B72F',       // Warm amber
    error: '#FF7B72',         // Soft red
    muted: '#6E7681',         // Dimmed gray
    userText: '#E6EDF3',      // Bright white-ish
    assistantText: '#D2D9E0', // Soft white
    toolName: '#D2A8FF',      // Lavender purple
    code: '#A5D6FF',          // Light blue
    border: '#30363D',        // Dark border
    badge: '#484F58',         // Badge gray
    accent2: '#FFA657',       // Orange accent
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
