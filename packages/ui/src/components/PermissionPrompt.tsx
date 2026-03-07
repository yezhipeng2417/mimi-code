/**
 * PermissionPrompt — Asks user for tool permission with a styled card.
 *
 * Keyboard:
 *   y → Allow (one-time)
 *   n → Deny
 *   a → Always Allow (persist for session)
 *   Esc → Deny
 */

import React from 'react';
import { Text, Box, useInput } from 'ink';
import { useTheme } from '../ThemeContext.js';

interface PermissionPromptProps {
  toolName: string;
  input: string;
  onAllow: () => void;
  onDeny: () => void;
  onAlwaysAllow: () => void;
}

export function PermissionPrompt({
  toolName,
  input,
  onAllow,
  onDeny,
  onAlwaysAllow,
}: PermissionPromptProps): React.ReactElement {
  const theme = useTheme();

  useInput((char, key) => {
    if (key.escape || char === 'n' || char === 'N') {
      onDeny();
    } else if (char === 'y' || char === 'Y') {
      onAllow();
    } else if (char === 'a' || char === 'A') {
      onAlwaysAllow();
    }
  });

  // Truncate input display
  const displayInput = input.length > 200 ? `${input.slice(0, 197)}...` : input;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.warning}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      {/* Header */}
      <Box>
        <Text color={theme.colors.warning} bold>
          {theme.symbols.warning} Permission Required
        </Text>
      </Box>

      {/* Tool name */}
      <Box marginTop={1}>
        <Text color={theme.colors.muted}>Tool: </Text>
        <Text color={theme.colors.toolName} bold>{toolName}</Text>
      </Box>

      {/* Input preview */}
      {displayInput && (
        <Box marginTop={0}>
          <Text color={theme.colors.border} wrap="truncate-end">
            {displayInput}
          </Text>
        </Box>
      )}

      {/* Divider */}
      <Box marginTop={1}>
        <Text color={theme.colors.border}>
          {theme.symbols.hrule.repeat(40)}
        </Text>
      </Box>

      {/* Actions */}
      <Box marginTop={1} gap={2}>
        <Text>
          <Text color={theme.colors.success} bold>[y]</Text>
          <Text color={theme.colors.muted}> Allow</Text>
        </Text>
        <Text>
          <Text color={theme.colors.error} bold>[n]</Text>
          <Text color={theme.colors.muted}> Deny</Text>
        </Text>
        <Text>
          <Text color={theme.colors.primary} bold>[a]</Text>
          <Text color={theme.colors.muted}> Always</Text>
        </Text>
      </Box>
    </Box>
  );
}
