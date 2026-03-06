/**
 * StreamingText — Renders assistant response with typing cursor.
 *
 * Shows the gold assistant accent while text streams in,
 * with an animated block cursor at the end.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
}

export function StreamingText({
  text,
  isStreaming,
}: StreamingTextProps): React.ReactElement {
  return (
    <Box flexDirection="row">
      {/* Left accent bar — gold for assistant */}
      <Box marginRight={1}>
        <Text color={defaultTheme.colors.primary}>{defaultTheme.symbols.vbar}</Text>
      </Box>

      {/* Text content */}
      <Box flexDirection="column" flexGrow={1}>
        {/* Role header */}
        <Box>
          <Text color={defaultTheme.colors.primary} bold>
            {defaultTheme.symbols.assistantIcon} Mimi
          </Text>
        </Box>
        <Text color={defaultTheme.colors.assistantText} wrap="wrap">
          {text}
          {isStreaming ? <Text color={defaultTheme.colors.accent2}>▊</Text> : null}
        </Text>
      </Box>
    </Box>
  );
}
