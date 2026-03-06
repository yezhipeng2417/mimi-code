/**
 * Spinner — Animated loading indicator with parrot personality.
 *
 * Uses smooth braille-dot animation with optional label.
 */

import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';

interface SpinnerProps {
  label?: string;
  color?: string;
}

export function Spinner({ label, color }: SpinnerProps): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const frames = defaultTheme.symbols.spinner;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 80);
    return () => clearInterval(interval);
  }, [frames.length]);

  const spinnerChar = frames[frame] ?? '⣾';
  const spinnerColor = color ?? defaultTheme.colors.primary;

  return (
    <Box>
      <Text color={spinnerColor} bold>{spinnerChar}</Text>
      {label ? (
        <Text color={defaultTheme.colors.muted}> {label}</Text>
      ) : null}
    </Box>
  );
}
