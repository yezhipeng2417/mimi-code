/**
 * StatusBar component — bottom bar showing session info.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';

interface StatusBarProps {
  model: string;
  tokenCount: number;
  costUsd: number;
  sessionId?: string;
  cacheHitRate?: number;
}

export function StatusBar({
  model,
  tokenCount,
  costUsd,
  cacheHitRate,
}: StatusBarProps): React.ReactElement {
  const tokenStr = tokenCount > 1000 ? `${(tokenCount / 1000).toFixed(1)}k` : String(tokenCount);
  const costStr = costUsd > 0 ? `$${costUsd.toFixed(4)}` : '$0';
  const cacheStr = cacheHitRate !== undefined ? `${(cacheHitRate * 100).toFixed(0)}%` : undefined;

  return (
    <Box>
      <Text color={defaultTheme.colors.muted}>
        {model} {defaultTheme.symbols.bullet} {tokenStr} tokens {defaultTheme.symbols.bullet} {costStr}
        {cacheStr ? ` ${defaultTheme.symbols.bullet} cache: ${cacheStr}` : ''}
      </Text>
    </Box>
  );
}
