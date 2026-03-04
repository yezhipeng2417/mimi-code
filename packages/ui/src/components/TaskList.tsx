/**
 * TaskList — Displays the current todo list with status indicators.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from '../theme.js';

interface TaskItem {
  id: string;
  task: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface TaskListProps {
  /** List of tasks to display */
  tasks: TaskItem[];
  /** Optional title */
  title?: string;
}

const STATUS_ICONS: Record<TaskItem['status'], { icon: string; color: string }> = {
  pending: { icon: '○', color: defaultTheme.colors.muted },
  in_progress: { icon: '▸', color: defaultTheme.colors.warning },
  completed: { icon: '✓', color: defaultTheme.colors.success },
};

export function TaskList({ tasks, title }: TaskListProps): React.ReactElement {
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;

  return (
    <Box flexDirection="column">
      {title && (
        <Text bold>
          {title} ({completed}/{total})
        </Text>
      )}

      {tasks.map((task) => {
        const { icon, color } = STATUS_ICONS[task.status];
        return (
          <Box key={task.id}>
            <Text color={color}>{icon}</Text>
            <Text> </Text>
            <Text
              strikethrough={task.status === 'completed'}
              dimColor={task.status === 'completed'}
            >
              {task.task}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
