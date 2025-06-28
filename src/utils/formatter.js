export function formatTaskList(tasks, options = {}) {
  if (tasks.length === 0) {
    if (options.session) {
      return formatSessionStatus(options.session);
    }
    return 'No tasks found.';
  }

  const grouped = groupTasksByPriority(tasks);
  let output = '';

  if (options.showCompleted) {
    output += '# Completed Tasks\n\n';
  } else {
    output += '# Active Tasks\n\n';
  }

  for (const priority of ['high', 'medium', 'low']) {
    const priorityTasks = grouped[priority];
    if (priorityTasks.length === 0) {
      continue;
    }

    output += `## ${priority.toUpperCase()} Priority\n\n`;

    const categorized = groupTasksByCategory(priorityTasks);

    for (const [category, categoryTasks] of Object.entries(categorized)) {
      if (category !== 'uncategorized') {
        output += `### ${getCategoryName(category)}\n`;
      }

      for (const task of categoryTasks) {
        output += formatTask(task) + '\n';
      }

      output += '\n';
    }
  }

  const total = tasks.length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const blocked = tasks.filter(t => t.status === 'blocked').length;

  output += '---\n';
  output += `*Total: ${total} tasks`;

  if (inProgress > 0) {
    output += ` (${inProgress} in-progress`;
  }
  if (blocked > 0) {
    output += `, ${blocked} blocked`;
  }
  if (inProgress > 0) {
    output += ')';
  }

  output += '*';

  return output;
}

export function formatTask(task) {
  const statusIcon = getStatusIcon(task.status);
  return `- [${statusIcon}] **${task.id}** ${task.description}`;
}

export function formatSessionStatus(session, stats = null) {
  let output = '# Session Status\n\n';

  if (session.currentTask) {
    output += `**Current Task**: ${session.currentTask}\n`;
    output += `**Started**: ${new Date(session.startedAt).toLocaleString()}\n`;
  } else {
    output += '**Current Task**: None\n';
  }

  if (session.branch) {
    output += `**Branch**: ${session.branch}\n`;
  }

  if (session.agent) {
    output += `**Agent**: ${session.agent}\n`;
  }

  if (session.filesModified && session.filesModified.length > 0) {
    output += `**Files Modified**: ${session.filesModified.join(', ')}\n`;
  }

  if (stats) {
    output += '\n## Statistics\n\n';
    output += `- **Total Tasks**: ${stats.total}\n`;
    output += `- **Todo**: ${stats.todo}\n`;
    output += `- **In Progress**: ${stats.inProgress}\n`;
    output += `- **Completed**: ${stats.completed}\n`;

    if (stats.blocked > 0) {
      output += `- **Blocked**: ${stats.blocked}\n`;
    }
  }

  return output;
}

export function formatStatsPlain(stats) {
  let output = 'Task Statistics\n\n';

  output += 'Overview:\n';
  output += `  Total Active Tasks: ${stats.total}\n`;
  output += `  Completed Tasks: ${stats.completed}\n`;
  output += `  Todo: ${stats.todo}\n`;
  output += `  In Progress: ${stats.inProgress}\n`;

  if (stats.blocked > 0) {
    output += `  Blocked: ${stats.blocked}\n`;
  }

  output += '\nBy Priority:\n';
  output += `  High: ${stats.priorities.high}\n`;
  output += `  Medium: ${stats.priorities.medium}\n`;
  output += `  Low: ${stats.priorities.low}\n`;

  const completionRate =
    stats.total + stats.completed > 0
      ? Math.round((stats.completed / (stats.total + stats.completed)) * 100)
      : 0;

  output += `\nCompletion Rate: ${completionRate}%`;

  return output;
}

export function formatTaskContext(task, context) {
  let output = `# Task Context: ${task.id}\n\n`;
  output += `**Description**: ${task.description}\n`;
  output += `**Priority**: ${task.priority.toUpperCase()}\n`;
  output += `**Status**: ${task.status}\n`;

  if (task.category) {
    output += `**Category**: ${getCategoryName(task.category)}\n`;
  }

  if (context.branch) {
    output += `**Branch**: ${context.branch}\n`;
  }

  if (context.baseBranch && context.baseBranch !== context.branch) {
    output += `**Base Branch**: ${context.baseBranch}\n`;
  }

  if (context.relatedFiles && context.relatedFiles.length > 0) {
    output += '\n## Related Files\n\n';
    for (const file of context.relatedFiles) {
      output += `- ${file}\n`;
    }
  }

  if (context.session && context.session.startedAt) {
    output += '\n## Session Info\n\n';
    output += `**Started**: ${new Date(context.session.startedAt).toLocaleString()}\n`;
    output += `**Agent**: ${context.session.agent || 'Unknown'}\n`;
  }

  return output;
}

export function formatStats(stats) {
  let output = '# Task Statistics\n\n';

  output += `## Overview\n\n`;
  output += `- **Total Active Tasks**: ${stats.total}\n`;
  output += `- **Completed Tasks**: ${stats.completed}\n`;
  output += `- **Todo**: ${stats.todo}\n`;
  output += `- **In Progress**: ${stats.inProgress}\n`;

  if (stats.blocked > 0) {
    output += `- **Blocked**: ${stats.blocked}\n`;
  }

  output += '\n## By Priority\n\n';
  output += `- **High**: ${stats.priorities.high}\n`;
  output += `- **Medium**: ${stats.priorities.medium}\n`;
  output += `- **Low**: ${stats.priorities.low}\n`;

  const completionRate =
    stats.total + stats.completed > 0
      ? Math.round((stats.completed / (stats.total + stats.completed)) * 100)
      : 0;

  output += `\n**Completion Rate**: ${completionRate}%`;

  return output;
}

function groupTasksByPriority(tasks) {
  return {
    high: tasks.filter(t => t.priority === 'high'),
    medium: tasks.filter(t => t.priority === 'medium'),
    low: tasks.filter(t => t.priority === 'low'),
  };
}

function groupTasksByCategory(tasks) {
  const grouped = {};

  for (const task of tasks) {
    const category = task.category || 'uncategorized';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(task);
  }

  return grouped;
}

function getStatusIcon(status) {
  switch (status) {
    case 'todo':
      return ' ';
    case 'in_progress':
      return '>';
    case 'completed':
      return 'x';
    case 'blocked':
      return '!';
    default:
      return ' ';
  }
}

function getCategoryName(category) {
  const names = {
    bugs: 'Bug Fixes',
    features: 'Features',
    docs: 'Documentation',
    refactor: 'Refactoring',
    test: 'Testing',
  };

  return names[category] || category;
}
