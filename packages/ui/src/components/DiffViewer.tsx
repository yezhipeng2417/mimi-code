/**
 * DiffViewer — Displays file diffs with color-coded additions/deletions.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';

interface DiffViewerProps {
  /** File path being diffed */
  filePath: string;
  /** Diff lines (with +/- prefixes) */
  lines: string[];
  /** Maximum lines to display */
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
    <Box flexDirection="column">
      <Text color={defaultTheme.colors.muted} bold>
        {filePath}
      </Text>

      {displayLines.map((line, i) => {
        let color = defaultTheme.colors.assistantText;
        if (line.startsWith('+')) color = defaultTheme.colors.success;
        else if (line.startsWith('-')) color = defaultTheme.colors.error;
        else if (line.startsWith('@@')) color = defaultTheme.colors.secondary;

        return (
          <Text key={i} color={color}>
            {line}
          </Text>
        );
      })}

      {truncated && (
        <Text color={defaultTheme.colors.muted}>
          ... ({lines.length - maxLines} more lines)
        </Text>
      )}
    </Box>
  );
}
