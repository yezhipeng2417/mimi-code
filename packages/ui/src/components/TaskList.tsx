/**
 * TaskList — Displays todo items with status icons and progress counter.
 *
 * Uses colored icons: ○ pending, ▸ in-progress, ✔ completed.
 * Completed tasks are dimmed with strikethrough.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../ThemeContext.js';
import type { Theme } from '../theme.js';

interface TaskItem {
  id: string;
  task: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface TaskListProps {
  tasks: TaskItem[];
  title?: string;
}

function getStatusIcon(status: TaskItem['status'], theme: Theme): { icon: string; color: string } {
  switch (status) {
    case 'pending': return { icon: '○', color: theme.colors.muted };
    case 'in_progress': return { icon: '▸', color: theme.colors.warning };
    case 'completed': return { icon: '✔', color: theme.colors.success };
  }
}

export function TaskList({ tasks, title }: TaskListProps): React.ReactElement {
  const theme = useTheme();
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Title with progress */}
      {title && (
        <Box>
          <Text bold>{title} </Text>
          <Text color={completed === total ? theme.colors.success : theme.colors.muted}>
            ({completed}/{total})
          </Text>
        </Box>
      )}

      {/* Task items */}
      {tasks.map((task) => {
        const { icon, color } = getStatusIcon(task.status, theme);
        const isDone = task.status === 'completed';

        return (
          <Box key={task.id}>
            <Text color={color}> {icon} </Text>
            <Text
              strikethrough={isDone}
              dimColor={isDone}
              color={isDone ? theme.colors.muted : theme.colors.assistantText}
            >
              {task.task}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
