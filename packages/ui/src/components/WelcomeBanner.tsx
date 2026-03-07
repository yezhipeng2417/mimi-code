/**
 * WelcomeBanner — Displays the ASCII art welcome screen with branding.
 *
 * Shows banner art, product name, version, and welcome message.
 * The banner.ts in @mimi/brand already renders with ANSI colors,
 * so we just add spacing and optional welcome text below.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../ThemeContext.js';

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
  const theme = useTheme();

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* ASCII art (already styled by @mimi/brand) */}
      <Text>{bannerText}</Text>

      {/* Product info line */}
      {(productName || version) && (
        <Box marginLeft={4}>
          {productName && (
            <Text color={theme.colors.primary} bold>{productName}</Text>
          )}
          {version && (
            <Text color={theme.colors.muted}> v{version}</Text>
          )}
        </Box>
      )}

      {/* Welcome message */}
      {welcomeMessage && (
        <Box marginLeft={4} marginTop={1}>
          <Text color={theme.colors.muted}>{welcomeMessage}</Text>
        </Box>
      )}

      {/* Subtle hint */}
      <Box marginLeft={4} marginTop={0}>
        <Text color={theme.colors.border}>
          Type a message to get started {theme.symbols.bullet} /help for commands {theme.symbols.bullet} Ctrl+C twice to exit
        </Text>
      </Box>
    </Box>
  );
}
