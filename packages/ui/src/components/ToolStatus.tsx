/**
 * ToolStatus component — shows tool execution state.
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
  const icon =
    status === 'running'
      ? null
      : status === 'completed'
        ? defaultTheme.symbols.success
        : defaultTheme.symbols.error;

  const iconColor =
    status === 'completed'
      ? defaultTheme.colors.success
      : status === 'error'
        ? defaultTheme.colors.error
        : undefined;

  const duration = durationMs ? ` (${(durationMs / 1000).toFixed(1)}s)` : '';

  return (
    <Box>
      {status === 'running' ? (
        <Spinner label="" />
      ) : (
        <Text color={iconColor}>{icon}</Text>
      )}
      <Text> </Text>
      <Text color={defaultTheme.colors.toolName} bold>
        {toolName}
      </Text>
      {summary ? (
        <Text color={defaultTheme.colors.muted}> {summary}</Text>
      ) : null}
      {duration ? (
        <Text color={defaultTheme.colors.muted}>{duration}</Text>
      ) : null}
    </Box>
  );
}
