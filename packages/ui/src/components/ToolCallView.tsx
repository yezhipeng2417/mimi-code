/**
 * ToolCallView — Compact tool call display with colored left-border accent.
 *
 * Shows: icon | toolName (duration)
 * With optional expandable input/output.
 */

import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';

interface ToolCallViewProps {
  toolName: string;
  input?: string;
  output?: string;
  isError?: boolean;
  durationMs?: number;
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
  const accentColor = isError ? defaultTheme.colors.error : defaultTheme.colors.success;
  const duration = durationMs !== undefined ? `${durationMs}ms` : '';

  // Extract a short summary from tool name
  const shortName = toolName.startsWith('mcp__')
    ? toolName.replace(/^mcp__[^_]+__/, '')
    : toolName;

  return (
    <Box flexDirection="row">
      {/* Left accent bar */}
      <Box marginRight={1}>
        <Text color={accentColor}>{defaultTheme.symbols.vbar}</Text>
      </Box>

      {/* Content */}
      <Box flexDirection="column">
        {/* Header line */}
        <Box gap={1}>
          <Text color={accentColor}>{icon}</Text>
          <Text color={defaultTheme.colors.toolName} bold>{shortName}</Text>
          {duration && (
            <Text color={defaultTheme.colors.border}>{duration}</Text>
          )}
        </Box>

        {/* Expanded details */}
        {expanded && input && (
          <Box marginLeft={2}>
            <Text color={defaultTheme.colors.muted} wrap="truncate-end">
              {defaultTheme.symbols.arrow} {input.slice(0, 200)}
            </Text>
          </Box>
        )}

        {expanded && output && (
          <Box marginLeft={2}>
            <Text
              color={isError ? defaultTheme.colors.error : defaultTheme.colors.code}
              wrap="truncate-end"
            >
              {output.slice(0, 500)}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
