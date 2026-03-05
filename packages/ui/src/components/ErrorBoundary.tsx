/**
 * ErrorBoundary — Catches React errors in the TUI and displays a fallback.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <Box flexDirection="column" borderStyle="round" borderColor={defaultTheme.colors.error} paddingX={1}>
          <Text color={defaultTheme.colors.error} bold>
            {defaultTheme.symbols.error} UI Error
          </Text>
          <Box marginTop={1}>
            <Text color={defaultTheme.colors.muted}>
              {this.state.error.message}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={defaultTheme.colors.muted}>
              The CLI is still running. Press Ctrl+C to exit.
            </Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
