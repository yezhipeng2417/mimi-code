/**
 * DiffViewer — Displays file diffs with color-coded lines and file header.
 *
 * Uses green/red for +/- lines, blue for @@ markers,
 * with a bordered file path header.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';

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
  const displayLines = lines.slice(0, maxLines);
  const truncated = lines.length > maxLines;

  return (
    <Box flexDirection="column" marginY={1}>
      {/* File header */}
      <Box>
        <Text color={defaultTheme.colors.border}>{defaultTheme.symbols.hrule}{defaultTheme.symbols.hrule} </Text>
        <Text color={defaultTheme.colors.code} bold>{filePath}</Text>
        <Text color={defaultTheme.colors.border}> {defaultTheme.symbols.hrule.repeat(Math.max(1, 40 - filePath.length))}</Text>
      </Box>

      {/* Diff lines */}
      {displayLines.map((line, i) => {
        let color = defaultTheme.colors.assistantText;
        let prefix = ' ';
        if (line.startsWith('+')) {
          color = defaultTheme.colors.success;
          prefix = '+';
        } else if (line.startsWith('-')) {
          color = defaultTheme.colors.error;
          prefix = '-';
        } else if (line.startsWith('@@')) {
          color = defaultTheme.colors.secondary;
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
          <Text color={defaultTheme.colors.muted}>
            {defaultTheme.symbols.bullet} {lines.length - maxLines} more lines
          </Text>
        </Box>
      )}
    </Box>
  );
}
