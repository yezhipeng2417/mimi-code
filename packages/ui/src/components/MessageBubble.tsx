/**
 * MessageBubble — Renders a conversation message with role accent.
 *
 * User messages get a blue left-bar, assistant gets gold.
 * Each message has a role icon + label header.
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
  const accentColor = isUser
    ? defaultTheme.colors.secondary
    : defaultTheme.colors.primary;
  const textColor = isUser
    ? defaultTheme.colors.userText
    : defaultTheme.colors.assistantText;
  const icon = isUser
    ? defaultTheme.symbols.userIcon
    : defaultTheme.symbols.assistantIcon;
  const label = isUser ? 'You' : 'Mimi';

  return (
    <Box flexDirection="row" marginBottom={1}>
      {/* Left accent bar */}
      <Box flexDirection="column" marginRight={1}>
        <Text color={accentColor}>{defaultTheme.symbols.vbar}</Text>
      </Box>

      {/* Content */}
      <Box flexDirection="column" flexGrow={1}>
        {/* Header: icon + role label */}
        <Box>
          <Text color={accentColor} bold>
            {icon} {label}
          </Text>
        </Box>
        {/* Message text */}
        <Box marginTop={0}>
          <Text color={textColor} wrap="wrap">{text}</Text>
        </Box>
      </Box>
    </Box>
  );
}
