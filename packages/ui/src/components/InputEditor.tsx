/**
 * InputEditor — User input with fancy prompt and cursor.
 *
 * Features:
 *   - Colored prompt icon
 *   - Blinking block cursor
 *   - Placeholder text when empty
 *   - Ctrl+U to clear line
 */

import React, { useState } from 'react';
import { Text, Box, useInput } from 'ink';
import { defaultTheme } from '../theme.js';

interface InputEditorProps {
  prompt?: string;
  placeholder?: string;
  onSubmit: (text: string) => void;
  isActive?: boolean;
}

export function InputEditor({
  prompt,
  placeholder,
  onSubmit,
  isActive = true,
}: InputEditorProps): React.ReactElement {
  const [value, setValue] = useState('');

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.return) {
        if (value.trim()) {
          onSubmit(value);
          setValue('');
        }
        return;
      }

      if (key.backspace || key.delete) {
        setValue((prev) => prev.slice(0, -1));
        return;
      }

      if (key.ctrl && input === 'c') {
        return;
      }

      if (key.ctrl && input === 'u') {
        setValue('');
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        setValue((prev) => prev + input);
      }
    },
    { isActive },
  );

  const displayPrompt = prompt ?? defaultTheme.symbols.prompt;
  const displayText = value || placeholder || '';
  const isPlaceholder = !value && !!placeholder;

  return (
    <Box flexDirection="column">
      {/* Input row */}
      <Box>
        <Text color={isActive ? defaultTheme.colors.primary : defaultTheme.colors.muted} bold>
          {displayPrompt}{' '}
        </Text>
        <Text dimColor={isPlaceholder} color={isPlaceholder ? defaultTheme.colors.muted : defaultTheme.colors.userText}>
          {displayText}
        </Text>
        {isActive && <Text color={defaultTheme.colors.primary}>▊</Text>}
      </Box>
    </Box>
  );
}
