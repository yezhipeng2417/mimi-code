/**
 * InputEditor — Multi-line input editor with key bindings.
 */

import React, { useState } from 'react';
import { Text, Box, useInput } from 'ink';
import { defaultTheme } from '../theme.js';

interface InputEditorProps {
  /** Prompt symbol (e.g., "❯") */
  prompt?: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Called when user submits input (Enter on single line) */
  onSubmit: (text: string) => void;
  /** Whether the input is focused */
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
    <Box>
      <Text color={defaultTheme.colors.primary}>{displayPrompt} </Text>
      <Text dimColor={isPlaceholder}>{displayText}</Text>
      {isActive && <Text color={defaultTheme.colors.primary}>█</Text>}
    </Box>
  );
}
