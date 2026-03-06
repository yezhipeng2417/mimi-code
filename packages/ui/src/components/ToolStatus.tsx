/**
 * ToolStatus — Shows tool execution state with accent coloring.
 *
 * Running → spinner + tool name
 * Completed → green check + tool name + duration
 * Error → red x + tool name
 */

import React from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';
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
  const accentColor =
    status === 'completed'
      ? defaultTheme.colors.success
      : status === 'error'
        ? defaultTheme.colors.error
        : defaultTheme.colors.primary;

  const icon =
    status === 'completed'
      ? defaultTheme.symbols.success
      : status === 'error'
        ? defaultTheme.symbols.error
        : null;

  const duration = durationMs ? `${(durationMs / 1000).toFixed(1)}s` : '';

  return (
    <Box>
      {/* Left accent */}
      <Text color={accentColor}>{defaultTheme.symbols.vbar} </Text>

      {/* Icon or spinner */}
      {status === 'running' ? (
        <Spinner color={accentColor} />
      ) : (
        <Text color={accentColor}>{icon}</Text>
      )}

      <Text> </Text>
      <Text color={defaultTheme.colors.toolName} bold>{toolName}</Text>

      {summary && (
        <Text color={defaultTheme.colors.muted}> {summary}</Text>
      )}
      {duration && (
        <Text color={defaultTheme.colors.border}> {duration}</Text>
      )}
    </Box>
  );
}
