/**
 * ThemeContext — React context for theme propagation.
 *
 * Provides the active theme to all child components via useTheme() hook.
 * Falls back to defaultTheme if no provider is found.
 */

import React, { createContext, useContext } from 'react';
import type { Theme } from './theme.js';
import { defaultTheme } from './theme.js';

const ThemeCtx = createContext<Theme>(defaultTheme);

export interface ThemeProviderProps {
  theme: Theme;
  children: React.ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps): React.ReactElement {
  return React.createElement(ThemeCtx.Provider, { value: theme }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeCtx);
}
