/**
 * Spinner component — animated loading indicator.
 */

import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
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

  const spinnerChar = frames[frame] ?? '⠋';

  return (
    <Text>
      <Text color={color ?? defaultTheme.colors.primary}>{spinnerChar}</Text>
      {label ? <Text> {label}</Text> : null}
    </Text>
  );
}
