/**
 * TaskList — Displays todo items with status icons and progress counter.
 *
 * Uses colored icons: ○ pending, ▸ in-progress, ✔ completed.
 * Completed tasks are dimmed with strikethrough.
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
  tasks: TaskItem[];
  title?: string;
}

const STATUS_ICONS: Record<TaskItem['status'], { icon: string; color: string }> = {
  pending: { icon: '○', color: defaultTheme.colors.muted },
  in_progress: { icon: '▸', color: defaultTheme.colors.warning },
  completed: { icon: '✔', color: defaultTheme.colors.success },
};

export function TaskList({ tasks, title }: TaskListProps): React.ReactElement {
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Title with progress */}
      {title && (
        <Box>
          <Text bold>{title} </Text>
          <Text color={completed === total ? defaultTheme.colors.success : defaultTheme.colors.muted}>
            ({completed}/{total})
          </Text>
        </Box>
      )}

      {/* Task items */}
      {tasks.map((task) => {
        const { icon, color } = STATUS_ICONS[task.status];
        const isDone = task.status === 'completed';

        return (
          <Box key={task.id}>
            <Text color={color}> {icon} </Text>
            <Text
              strikethrough={isDone}
              dimColor={isDone}
              color={isDone ? defaultTheme.colors.muted : defaultTheme.colors.assistantText}
            >
              {task.task}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
