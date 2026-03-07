/**
 * Spinner — Animated loading indicator with parrot personality.
 *
 * Uses smooth braille-dot animation with optional label.
 */

import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../ThemeContext.js';

interface SpinnerProps {
  label?: string;
  color?: string;
}

export function Spinner({ label, color }: SpinnerProps): React.ReactElement {
  const theme = useTheme();
  const [frame, setFrame] = useState(0);
  const frames = theme.symbols.spinner;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 80);
    return () => clearInterval(interval);
  }, [frames.length]);

  const spinnerChar = frames[frame] ?? '⣾';
  const spinnerColor = color ?? theme.colors.primary;

  return (
    <Box>
      <Text color={spinnerColor} bold>{spinnerChar}</Text>
      {label ? (
        <Text color={theme.colors.muted}> {label}</Text>
      ) : null}
    </Box>
  );
}
