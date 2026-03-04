/**
 * MessageBubble component — renders a conversation message.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  text: string;
}

export function MessageBubble({
  role,
  text,
}: MessageBubbleProps): React.ReactElement {
  const isUser = role === 'user';
  const color = isUser
    ? defaultTheme.colors.userText
    : defaultTheme.colors.assistantText;

  const label = isUser ? 'You' : 'Mimi';
  const labelColor = isUser
    ? defaultTheme.colors.secondary
    : defaultTheme.colors.primary;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={labelColor} bold>
        {label}
      </Text>
      <Text color={color}>{text}</Text>
    </Box>
  );
}
