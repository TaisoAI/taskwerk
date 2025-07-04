/**
 * TaskWerk v3 Formatting Utilities
 *
 * Provides consistent formatting for task display across the CLI
 */

import chalk from 'chalk';

/**
 * Format a single task for display
 */
export function formatTask(task, options = {}) {
  const { showDetails = false, showNotes = false, indent = 0 } = options;

  const indentStr = ' '.repeat(indent);
  const lines = [];

  // Task header with ID, status, and name
  const statusColor = getStatusColor(task.status);
  const statusIcon = getStatusIcon(task.status);
  const priorityIcon = getPriorityIcon(task.priority);

  lines.push(
    indentStr +
      chalk.gray(task.string_id || `TASK-${String(task.id).padStart(3, '0')}`) +
      ' ' +
      statusColor(statusIcon) +
      ' ' +
      priorityIcon +
      ' ' +
      chalk.bold(task.name)
  );

  // Show details if requested
  if (showDetails) {
    if (task.description) {
      lines.push(indentStr + '  ' + chalk.gray(task.description));
    }

    const details = [];
    if (task.assignee) {
      details.push(`Assignee: ${chalk.cyan(task.assignee)}`);
    }
    if (task.category) {
      details.push(`Category: ${chalk.magenta(task.category)}`);
    }
    if (task.estimated) {
      details.push(`Estimate: ${chalk.yellow(task.estimated)}`);
    }
    if (task.progress > 0) {
      details.push(`Progress: ${formatProgress(task.progress)}`);
    }

    if (details.length > 0) {
      lines.push(indentStr + '  ' + details.join(' • '));
    }

    // Show dates
    const dates = [];
    if (task.created_at) {
      dates.push(`Created: ${formatDate(task.created_at)}`);
    }
    if (task.updated_at && task.updated_at !== task.created_at) {
      dates.push(`Updated: ${formatDate(task.updated_at)}`);
    }
    if (task.completed_at) {
      dates.push(`Completed: ${formatDate(task.completed_at)}`);
    }

    if (dates.length > 0) {
      lines.push(indentStr + '  ' + chalk.gray(dates.join(' • ')));
    }

    // Show dependencies
    if (task.dependencies && task.dependencies.length > 0) {
      lines.push(
        indentStr +
          '  ' +
          chalk.gray(`Depends on: ${task.dependencies.map(d => d.depends_on_name).join(', ')}`)
      );
    }

    if (task.dependents && task.dependents.length > 0) {
      lines.push(
        indentStr +
          '  ' +
          chalk.gray(`Blocks: ${task.dependents.map(d => d.dependent_name).join(', ')}`)
      );
    }

    // Show keywords
    if (task.keywords && task.keywords.length > 0) {
      const tags = task.keywords.map(k => chalk.blue(`#${k.keyword}`)).join(' ');
      lines.push(indentStr + '  ' + tags);
    }
  }

  // Show recent notes if requested
  if (showNotes && task.recent_notes && task.recent_notes.length > 0) {
    lines.push(indentStr + '  ' + chalk.gray('Recent notes:'));
    for (const note of task.recent_notes.slice(0, 3)) {
      const noteText = note.note.length > 60 ? note.note.substring(0, 60) + '...' : note.note;
      lines.push(indentStr + '    ' + chalk.gray(`• ${noteText}`));
    }
  }

  return lines.join('\n');
}

/**
 * Format a list of tasks
 */
export function formatTaskList(tasks, options = {}) {
  const { showDetails = false, showNotes = false, groupBy = null, showStats = true } = options;

  const lines = [];

  // Group tasks if requested
  if (groupBy) {
    const groups = groupTasks(tasks, groupBy);

    for (const [groupName, groupTasks] of Object.entries(groups)) {
      if (groupTasks.length === 0) {
        continue;
      }

      lines.push(chalk.bold.underline(groupName || 'Uncategorized'));
      lines.push('');

      for (const task of groupTasks) {
        lines.push(formatTask(task, { showDetails, showNotes, indent: 2 }));
      }
      lines.push('');
    }
  } else {
    // Simple list
    for (const task of tasks) {
      lines.push(formatTask(task, { showDetails, showNotes }));
    }
  }

  // Show statistics
  if (showStats) {
    lines.push('');
    lines.push(formatTaskStats(tasks));
  }

  return lines.join('\n');
}

/**
 * Format task statistics
 */
export function formatTaskStats(tasks) {
  const stats = {
    total: tasks.length,
    byStatus: {},
    byPriority: {},
  };

  // Calculate statistics
  for (const task of tasks) {
    stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
    stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
  }

  const lines = [];
  lines.push(chalk.gray('─'.repeat(40)));

  // Status summary
  const statusParts = [];
  for (const [status, count] of Object.entries(stats.byStatus)) {
    const color = getStatusColor(status);
    statusParts.push(color(`${status}: ${count}`));
  }
  lines.push('Status: ' + statusParts.join(' • '));

  // Priority summary
  const priorityParts = [];
  for (const [priority, count] of Object.entries(stats.byPriority)) {
    const icon = getPriorityIcon(priority);
    priorityParts.push(`${icon} ${priority}: ${count}`);
  }
  lines.push('Priority: ' + priorityParts.join(' • '));

  lines.push(`Total: ${stats.total} tasks`);

  return lines.join('\n');
}

/**
 * Group tasks by a field
 */
function groupTasks(tasks, groupBy) {
  const groups = {};

  for (const task of tasks) {
    const key = task[groupBy] || '';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(task);
  }

  return groups;
}

/**
 * Get color for task status
 */
function getStatusColor(status) {
  switch (status) {
    case 'todo':
      return chalk.white;
    case 'in_progress':
      return chalk.yellow;
    case 'blocked':
      return chalk.red;
    case 'completed':
      return chalk.green;
    case 'archived':
      return chalk.gray;
    case 'error':
      return chalk.red;
    default:
      return chalk.white;
  }
}

/**
 * Get icon for task status
 */
function getStatusIcon(status) {
  switch (status) {
    case 'todo':
      return '○';
    case 'in_progress':
      return '◐';
    case 'blocked':
      return '⊗';
    case 'completed':
      return '✓';
    case 'archived':
      return '⊡';
    case 'error':
      return '✗';
    default:
      return '?';
  }
}

/**
 * Get icon for task priority
 */
function getPriorityIcon(priority) {
  switch (priority) {
    case 'high':
      return chalk.red('●');
    case 'medium':
      return chalk.yellow('●');
    case 'low':
      return chalk.green('●');
    default:
      return chalk.gray('●');
  }
}

/**
 * Format progress bar
 */
function formatProgress(percentage) {
  const width = 10;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return `${bar} ${percentage}%`;
}

/**
 * Format date for display
 */
export function formatDate(dateStr, options = {}) {
  const { relative = false, time = false } = options;

  const date = new Date(dateStr);

  if (relative) {
    return formatRelativeDate(date);
  }

  const dateOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  if (time) {
    dateOptions.hour = '2-digit';
    dateOptions.minute = '2-digit';
  }

  return date.toLocaleString('en-US', dateOptions);
}

/**
 * Format relative date
 */
function formatRelativeDate(date) {
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return formatDate(date);
  } else if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'just now';
  }
}

/**
 * Format duration
 */
export function formatDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end - start;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  const parts = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

export default {
  formatTask,
  formatTaskList,
  formatTaskStats,
  formatDate,
  formatDuration,
};
