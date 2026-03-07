/**
 * StreamingText — Renders assistant response with typing cursor.
 *
 * Shows the gold assistant accent while text streams in,
 * with an animated block cursor at the end.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../ThemeContext.js';

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
}

export function StreamingText({
  text,
  isStreaming,
}: StreamingTextProps): React.ReactElement {
  const theme = useTheme();

  return (
    <Box flexDirection="row">
      {/* Left accent bar — gold for assistant */}
      <Box marginRight={1}>
        <Text color={theme.colors.primary}>{theme.symbols.vbar}</Text>
      </Box>

      {/* Text content */}
      <Box flexDirection="column" flexGrow={1}>
        {/* Role header */}
        <Box>
          <Text color={theme.colors.primary} bold>
            {theme.symbols.assistantIcon} Mimi
          </Text>
        </Box>
        <Text color={theme.colors.assistantText} wrap="wrap">
          {text}
          {isStreaming ? <Text color={theme.colors.accent2}>▊</Text> : null}
        </Text>
      </Box>
    </Box>
  );
}
