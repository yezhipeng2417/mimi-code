/**
 * StatusBar — Bottom bar with model badge, token count, cost, and cache metrics.
 *
 * Shows a horizontal rule divider, then compact metric badges.
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
  const costStr = costUsd > 0 ? `$${costUsd.toFixed(4)}` : '$0.00';
  const cacheStr = cacheHitRate !== undefined
    ? `${(cacheHitRate * 100).toFixed(0)}%`
    : undefined;

  // Short model display name
  const modelShort = model
    .replace('claude-', '')
    .replace('-20251001', '');

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Divider line */}
      <Box>
        <Text color={defaultTheme.colors.border}>
          {defaultTheme.symbols.hrule.repeat(60)}
        </Text>
      </Box>

      {/* Metrics row */}
      <Box gap={1}>
        {/* Model badge */}
        <Text>
          <Text color={defaultTheme.colors.primary} bold>{modelShort}</Text>
        </Text>

        <Text color={defaultTheme.colors.border}>{defaultTheme.symbols.vbar}</Text>

        {/* Tokens */}
        <Text>
          <Text color={defaultTheme.colors.muted}>{tokenStr}</Text>
          <Text color={defaultTheme.colors.border}> tok</Text>
        </Text>

        <Text color={defaultTheme.colors.border}>{defaultTheme.symbols.vbar}</Text>

        {/* Cost */}
        <Text>
          <Text color={costUsd > 0.01 ? defaultTheme.colors.warning : defaultTheme.colors.muted}>
            {costStr}
          </Text>
        </Text>

        {/* Cache hit rate */}
        {cacheStr && (
          <>
            <Text color={defaultTheme.colors.border}>{defaultTheme.symbols.vbar}</Text>
            <Text>
              <Text color={defaultTheme.colors.success}>⚡</Text>
              <Text color={defaultTheme.colors.muted}>{cacheStr}</Text>
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
}
