/**
 * ToolStatus — Shows tool execution state with accent coloring.
 *
 * Running → spinner + tool name
 * Completed → green check + tool name + duration
 * Error → red x + tool name
 */

import React from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../ThemeContext.js';
import { Spinner } from './Spinner.js';

interface ToolStatusProps {
  toolName: string;
  status: 'running' | 'completed' | 'error';
  summary?: string;
  durationMs?: number;
}

export function ToolStatus({
  toolName,
  status,
  summary,
  durationMs,
}: ToolStatusProps): React.ReactElement {
  const theme = useTheme();
  const accentColor =
    status === 'completed'
      ? theme.colors.success
      : status === 'error'
        ? theme.colors.error
        : theme.colors.primary;

  const icon =
    status === 'completed'
      ? theme.symbols.success
      : status === 'error'
        ? theme.symbols.error
        : null;

  const duration = durationMs ? `${(durationMs / 1000).toFixed(1)}s` : '';

  return (
    <Box>
      {/* Left accent */}
      <Text color={accentColor}>{theme.symbols.vbar} </Text>

      {/* Icon or spinner */}
      {status === 'running' ? (
        <Spinner color={accentColor} />
      ) : (
        <Text color={accentColor}>{icon}</Text>
      )}

      <Text> </Text>
      <Text color={theme.colors.toolName} bold>{toolName}</Text>

      {summary && (
        <Text color={theme.colors.muted}> {summary}</Text>
      )}
      {duration && (
        <Text color={theme.colors.border}> {duration}</Text>
      )}
    </Box>
  );
}
