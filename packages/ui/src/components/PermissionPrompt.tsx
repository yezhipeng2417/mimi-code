/**
 * PermissionPrompt component — asks user for tool permission.
 *
 * Handles keyboard input:
 *   y → Allow (one-time)
 *   n → Deny
 *   a → Always Allow (persist for session)
 */

import React from 'react';
import { Text, Box, useInput } from 'ink';
import { defaultTheme } from '../theme.js';

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
  useInput((char, key) => {
    if (key.escape || char === 'n' || char === 'N') {
      onDeny();
    } else if (char === 'y' || char === 'Y') {
      onAllow();
    } else if (char === 'a' || char === 'A') {
      onAlwaysAllow();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={defaultTheme.colors.warning} paddingX={1}>
      <Text color={defaultTheme.colors.warning} bold>
        {defaultTheme.symbols.warning} Permission Required
      </Text>
      <Box marginTop={1}>
        <Text>
          Tool: <Text color={defaultTheme.colors.toolName} bold>{toolName}</Text>
        </Text>
      </Box>
      <Box>
        <Text color={defaultTheme.colors.muted}>
          {input.length > 200 ? `${input.slice(0, 197)}...` : input}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text>
          <Text color={defaultTheme.colors.success}>[y]</Text> Allow{'  '}
          <Text color={defaultTheme.colors.error}>[n]</Text> Deny{'  '}
          <Text color={defaultTheme.colors.primary}>[a]</Text> Always Allow
        </Text>
      </Box>
    </Box>
  );
}
