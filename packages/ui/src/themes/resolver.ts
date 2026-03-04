/**
 * Theme resolver — resolves theme from brand overrides and built-in themes.
 */

import type { Theme } from '../theme.js';
import { defaultTheme, createTheme } from '../theme.js';
import { builtinThemes } from './builtin.js';

export interface ThemeResolverOptions {
  /** Brand theme overrides */
  brandTheme?: {
    name?: string;
    colors?: Partial<Theme['colors']>;
    symbols?: Partial<Theme['symbols']>;
  };
}

/**
 * Resolve the active theme from brand configuration.
 *
 * Resolution order:
 *   1. If brand specifies a named theme, use it as base
 *   2. Apply brand color/symbol overrides
 *   3. Fall back to default Mimi theme
 */
export function resolveTheme(options?: ThemeResolverOptions): Theme {
  if (!options?.brandTheme) {
    return defaultTheme;
  }

  const { brandTheme } = options;

  // Check if brand references a named built-in theme
  let baseTheme = defaultTheme;
  if (brandTheme.name && builtinThemes.has(brandTheme.name)) {
    baseTheme = builtinThemes.get(brandTheme.name)!;
  }

  // Apply overrides
  return createTheme({
    ...baseTheme,
    colors: { ...baseTheme.colors, ...(brandTheme.colors ?? {}) },
    symbols: { ...baseTheme.symbols, ...(brandTheme.symbols ?? {}) },
  });
}
