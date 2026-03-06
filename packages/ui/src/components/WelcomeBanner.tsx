/**
 * WelcomeBanner — Displays the ASCII art welcome screen with branding.
 *
 * Shows banner art, product name, version, and welcome message.
 * The banner.ts in @mimi/brand already renders with ANSI colors,
 * so we just add spacing and optional welcome text below.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';

interface WelcomeBannerProps {
  bannerText: string;
  version?: string;
  productName?: string;
  welcomeMessage?: string;
}

export function WelcomeBanner({
  bannerText,
  version,
  productName,
  welcomeMessage,
}: WelcomeBannerProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* ASCII art (already styled by @mimi/brand) */}
      <Text>{bannerText}</Text>

      {/* Product info line */}
      {(productName || version) && (
        <Box marginLeft={4}>
          {productName && (
            <Text color={defaultTheme.colors.primary} bold>{productName}</Text>
          )}
          {version && (
            <Text color={defaultTheme.colors.muted}> v{version}</Text>
          )}
        </Box>
      )}

      {/* Welcome message */}
      {welcomeMessage && (
        <Box marginLeft={4} marginTop={1}>
          <Text color={defaultTheme.colors.muted}>{welcomeMessage}</Text>
        </Box>
      )}

      {/* Subtle hint */}
      <Box marginLeft={4} marginTop={0}>
        <Text color={defaultTheme.colors.border}>
          Type a message to get started {defaultTheme.symbols.bullet} /help for commands {defaultTheme.symbols.bullet} Ctrl+C twice to exit
        </Text>
      </Box>
    </Box>
  );
}
