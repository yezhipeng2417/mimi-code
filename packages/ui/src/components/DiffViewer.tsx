/**
 * DiffViewer — Displays file diffs with color-coded lines and file header.
 *
 * Uses green/red for +/- lines, blue for @@ markers,
 * with a bordered file path header.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../ThemeContext.js';

interface DiffViewerProps {
  filePath: string;
  lines: string[];
  maxLines?: number;
}

export function DiffViewer({
  filePath,
  lines,
  maxLines = 30,
}: DiffViewerProps): React.ReactElement {
  const theme = useTheme();
  const displayLines = lines.slice(0, maxLines);
  const truncated = lines.length > maxLines;

  return (
    <Box flexDirection="column" marginY={1}>
      {/* File header */}
      <Box>
        <Text color={theme.colors.border}>{theme.symbols.hrule}{theme.symbols.hrule} </Text>
        <Text color={theme.colors.code} bold>{filePath}</Text>
        <Text color={theme.colors.border}> {theme.symbols.hrule.repeat(Math.max(1, 40 - filePath.length))}</Text>
      </Box>

      {/* Diff lines */}
      {displayLines.map((line, i) => {
        let color = theme.colors.assistantText;
        let prefix = ' ';
        if (line.startsWith('+')) {
          color = theme.colors.success;
          prefix = '+';
        } else if (line.startsWith('-')) {
          color = theme.colors.error;
          prefix = '-';
        } else if (line.startsWith('@@')) {
          color = theme.colors.secondary;
          prefix = '@';
        }

        return (
          <Box key={i}>
            <Text color={color} dimColor={prefix === ' '}>{line}</Text>
          </Box>
        );
      })}

      {/* Truncation notice */}
      {truncated && (
        <Box>
          <Text color={theme.colors.muted}>
            {theme.symbols.bullet} {lines.length - maxLines} more lines
          </Text>
        </Box>
      )}
    </Box>
  );
}
