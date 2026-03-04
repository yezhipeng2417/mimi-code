/**
 * WelcomeBanner — Displays the ASCII art welcome screen.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';

interface WelcomeBannerProps {
  /** ASCII art banner text */
  bannerText: string;
  /** Version string */
  version?: string;
  /** Product name */
  productName?: string;
  /** Welcome message */
  welcomeMessage?: string;
}

export function WelcomeBanner({
  bannerText,
  version,
  productName,
  welcomeMessage,
}: WelcomeBannerProps): React.ReactElement {
  return (
    <Box flexDirection="column" paddingY={1}>
      <Text>{bannerText}</Text>

      {(productName || version) && (
        <Box>
          {productName && <Text color={defaultTheme.colors.primary} bold>{productName}</Text>}
          {version && <Text color={defaultTheme.colors.muted}> v{version}</Text>}
        </Box>
      )}

      {welcomeMessage && (
        <Box marginTop={1}>
          <Text>{welcomeMessage}</Text>
        </Box>
      )}
    </Box>
  );
}
