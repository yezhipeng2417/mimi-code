/**
 * StreamingText component — renders text that streams in token by token.
 */

import React from 'react';
import { Text } from 'ink';
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
    <Text color={defaultTheme.colors.assistantText}>
      {text}
      {isStreaming ? <Text color={defaultTheme.colors.primary}>▌</Text> : null}
    </Text>
  );
}
