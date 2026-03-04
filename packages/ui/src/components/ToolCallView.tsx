/**
 * ToolCallView — Collapsed/expanded view of a tool call with its result.
 */

import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';

interface ToolCallViewProps {
  /** Tool name */
  toolName: string;
  /** Tool input (JSON stringified) */
  input?: string;
  /** Tool output text */
  output?: string;
  /** Whether the tool call errored */
  isError?: boolean;
  /** Duration in ms */
  durationMs?: number;
  /** Start expanded */
  defaultExpanded?: boolean;
}

export function ToolCallView({
  toolName,
  input,
  output,
  isError,
  durationMs,
  defaultExpanded = false,
}: ToolCallViewProps): React.ReactElement {
  const [expanded] = useState(defaultExpanded);

  const icon = isError ? defaultTheme.symbols.error : defaultTheme.symbols.success;
  const iconColor = isError ? defaultTheme.colors.error : defaultTheme.colors.success;
  const duration = durationMs !== undefined ? ` (${durationMs}ms)` : '';

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={iconColor}>{icon}</Text>
        <Text> </Text>
        <Text color={defaultTheme.colors.toolName} bold>{toolName}</Text>
        <Text color={defaultTheme.colors.muted}>{duration}</Text>
      </Box>

      {expanded && input && (
        <Box marginLeft={2}>
          <Text color={defaultTheme.colors.muted} wrap="truncate-end">
            Input: {input.slice(0, 200)}
          </Text>
        </Box>
      )}

      {expanded && output && (
        <Box marginLeft={2}>
          <Text color={isError ? defaultTheme.colors.error : defaultTheme.colors.code} wrap="truncate-end">
            {output.slice(0, 500)}
          </Text>
        </Box>
      )}
    </Box>
  );
}
