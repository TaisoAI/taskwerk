export class TaskParser {
  parseTasks(content) {
    const tasks = [];
    const lines = content.split('\n');
    let currentPriority = 'medium';
    let currentCategory = null;

    for (const line of lines) {
      // Track section context
      if (line.includes('HIGH Priority')) {
        currentPriority = 'high';
      } else if (line.includes('MEDIUM Priority')) {
        currentPriority = 'medium';
      } else if (line.includes('LOW Priority')) {
        currentPriority = 'low';
      }

      // Track category context
      if (line.includes('Bug Fixes')) {
        currentCategory = 'bugs';
      } else if (line.includes('Features')) {
        currentCategory = 'features';
      } else if (line.includes('Documentation')) {
        currentCategory = 'docs';
      } else if (line.includes('Refactoring')) {
        currentCategory = 'refactor';
      } else if (line.includes('Testing')) {
        currentCategory = 'test';
      }

      // Try parsing as completed task first, then as active task
      const task =
        this.parseCompletedTaskLine(line) ||
        this.parseTaskLine(line, currentPriority, currentCategory);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  parseTaskLine(line, contextPriority, contextCategory) {
    // Match task patterns: - [status] **TASK-001** Description
    const taskRegex = /^[-*]\s*\[([>\sx!])\]\s*\*\*([A-Z]+-\d+)\*\*\s*(.+)$/;
    const match = line.match(taskRegex);

    if (!match) {
      return null;
    }

    const [, statusChar, id, description] = match;

    return {
      id,
      description: description.trim(),
      status: this.parseStatus(statusChar),
      priority: contextPriority || this.extractPriority(line),
      category: contextCategory || this.extractCategory(line),
    };
  }

  parseCompletedTaskLine(line) {
    // Match completed task patterns: - [x] **TASK-001** Description *[timestamp]* or - ✅ **TASK-001** Description *[timestamp]*
    const completedRegexNew = /^[-*]\s*\[x\]\s*\*\*([A-Z]+-\d+)\*\*\s*(.+?)\s*\*\[([^\]]+)\]\*$/;
    const completedRegexOld = /^[-*]\s*✅\s*\*\*([A-Z]+-\d+)\*\*\s*(.+?)\s*\*\[([^\]]+)\]\*$/;
    // Match archived task pattern: - [~] **TASK-001** Description *[timestamp]*
    const archivedRegex = /^[-*]\s*\[~\]\s*\*\*([A-Z]+-\d+)\*\*\s*(.+?)\s*\*\[([^\]]+)\]\*$/;

    const completedMatch = line.match(completedRegexNew) || line.match(completedRegexOld);
    const archivedMatch = line.match(archivedRegex);

    if (completedMatch) {
      const [, id, description, timestamp] = completedMatch;

      return {
        id,
        description: description.trim(),
        status: 'completed',
        completedAt: timestamp,
        priority: 'medium', // Default for completed tasks
        category: null,
      };
    }

    if (archivedMatch) {
      const [, id, description, timestamp] = archivedMatch;

      return {
        id,
        description: description.trim(),
        status: 'archived',
        archivedAt: timestamp,
        priority: 'medium', // Default for archived tasks
        category: null,
      };
    }

    return null;
  }

  parseStatus(statusChar) {
    switch (statusChar) {
      case ' ':
        return 'todo';
      case '>':
        return 'in_progress';
      case 'x':
        return 'completed';
      case '!':
        return 'blocked';
      case '~':
        return 'archived';
      default:
        return 'todo';
    }
  }

  extractPriority(context) {
    if (context.includes('HIGH Priority')) {
      return 'high';
    }
    if (context.includes('MEDIUM Priority')) {
      return 'medium';
    }
    if (context.includes('LOW Priority')) {
      return 'low';
    }
    return 'medium';
  }

  extractCategory(context) {
    const categoryPatterns = [
      { pattern: /Bug/, name: 'bugs' },
      { pattern: /Feature/, name: 'features' },
      { pattern: /Documentation/, name: 'docs' },
      { pattern: /Refactor/, name: 'refactor' },
      { pattern: /Test/, name: 'test' },
    ];

    for (const { pattern, name } of categoryPatterns) {
      if (pattern.test(context)) {
        return name;
      }
    }

    return null;
  }

  updateHeader(content, allTasks = []) {
    const lines = content.split('\n');

    // Calculate next available ID
    const nextId = this.calculateNextId(allTasks);

    // Find where to insert/update the Next ID line
    let nextIdLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('*Next ID:')) {
        nextIdLineIndex = i;
        break;
      }
      // Insert after current session line, or after last * line
      if (lines[i].startsWith('*Current session:')) {
        nextIdLineIndex = i + 1;
        break;
      }
    }

    const nextIdLine = `*Next ID: ${nextId}*`;

    if (nextIdLineIndex === -1) {
      // Find the last metadata line (starting with *) and insert after it
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('*') && !lines[i + 1]?.startsWith('*')) {
          lines.splice(i + 1, 0, nextIdLine);
          break;
        }
      }
    } else if (lines[nextIdLineIndex].startsWith('*Next ID:')) {
      // Update existing line
      lines[nextIdLineIndex] = nextIdLine;
    } else {
      // Insert new line
      lines.splice(nextIdLineIndex, 0, nextIdLine);
    }

    return lines.join('\n');
  }

  calculateNextId(allTasks) {
    const existingIds = allTasks
      .map(task => task.id)
      .filter(id => id && id.startsWith('TASK-'))
      .map(id => parseInt(id.split('-')[1]))
      .filter(num => !isNaN(num))
      .sort((a, b) => a - b);

    let nextId = 1;
    for (const id of existingIds) {
      if (id === nextId) {
        nextId++;
      } else if (id > nextId) {
        break;
      }
    }

    return `TASK-${nextId.toString().padStart(3, '0')}`;
  }

  addTaskToContent(content, task, allTasks = []) {
    const lines = content.split('\n');

    // Include the new task in the calculation for next ID
    const allTasksIncludingNew = [...allTasks, task];

    // Update header with next available ID
    const updatedContent = this.updateHeader(lines.join('\n'), allTasksIncludingNew);
    const updatedLines = updatedContent.split('\n');

    const prioritySection = this.findPrioritySection(updatedLines, task.priority);
    const categorySection = this.findCategorySection(updatedLines, task.category, prioritySection);

    const taskLine = this.formatTaskLine(task);
    const insertIndex = this.findInsertionPoint(updatedLines, categorySection);

    updatedLines.splice(insertIndex, 0, taskLine);

    return updatedLines.join('\n');
  }

  updateTaskStatus(content, taskId, status) {
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`**${taskId}**`)) {
        const statusChar = this.statusToChar(status);
        lines[i] = lines[i].replace(/\[([>\sx!])\]/, `[${statusChar}]`);
        break;
      }
    }

    return lines.join('\n');
  }

  removeTask(content, taskId, allTasks = []) {
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`**${taskId}**`)) {
        lines.splice(i, 1);
        break;
      }
    }

    // Update header with next available ID after removing task
    const updatedContent = this.updateHeader(lines.join('\n'), allTasks);
    return updatedContent;
  }

  addCompletedTask(content, task) {
    const lines = content.split('\n');

    const taskEntry = this.formatCompletedTask(task);

    // Insert at the top after the header (most recent first)
    let insertIndex = 2; // After "# Completed Tasks" header

    // Skip any existing header comments or empty lines
    while (
      insertIndex < lines.length &&
      (lines[insertIndex].trim() === '' || lines[insertIndex].startsWith('*'))
    ) {
      insertIndex++;
    }

    lines.splice(insertIndex, 0, ...taskEntry);

    return lines.join('\n');
  }

  addArchivedTask(content, task) {
    const lines = content.split('\n');

    const taskEntry = this.formatArchivedTask(task);

    // Insert at the top after the header (most recent first)
    let insertIndex = 2; // After "# Completed Tasks" header

    // Skip any existing header comments or empty lines
    while (
      insertIndex < lines.length &&
      (lines[insertIndex].trim() === '' || lines[insertIndex].startsWith('*'))
    ) {
      insertIndex++;
    }

    lines.splice(insertIndex, 0, ...taskEntry);

    return lines.join('\n');
  }

  formatTaskLine(task) {
    const statusChar = this.statusToChar(task.status);
    return `- [${statusChar}] **${task.id}** ${task.description}`;
  }

  formatCompletedTask(task) {
    const timestamp = new Date(task.completedAt).toISOString();
    const lines = [`- [x] **${task.id}** ${task.description} *[${timestamp}]*`];

    if (task.note) {
      lines.push(`  ${task.note}`);
    }

    if (task.filesChanged && task.filesChanged.length > 0) {
      lines.push(`  Files: ${task.filesChanged.join(', ')}`);
    }

    lines.push('');

    return lines;
  }

  formatArchivedTask(task) {
    const timestamp = new Date(task.archivedAt).toISOString();
    const lines = [`- [~] **${task.id}** ${task.description} *[${timestamp}]*`];

    lines.push(`  **Archived:** ${task.archiveReason}`);

    if (task.supersededBy) {
      lines.push(`  **Superseded by:** ${task.supersededBy}`);
    }

    if (task.note) {
      lines.push(`  **Note:** ${task.note}`);
    }

    if (task.filesChanged && task.filesChanged.length > 0) {
      lines.push(`  Files: ${task.filesChanged.join(', ')}`);
    }

    lines.push('');

    return lines;
  }

  statusToChar(status) {
    switch (status) {
      case 'todo':
        return ' ';
      case 'in_progress':
        return '>';
      case 'completed':
        return 'x';
      case 'blocked':
        return '!';
      case 'archived':
        return '~';
      default:
        return ' ';
    }
  }

  findPrioritySection(lines, priority) {
    const priorityHeaders = {
      high: 'HIGH Priority',
      medium: 'MEDIUM Priority',
      low: 'LOW Priority',
    };

    const header = priorityHeaders[priority] || priorityHeaders.medium;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(header)) {
        return i;
      }
    }

    return -1;
  }

  findCategorySection(lines, category, startIndex) {
    if (!category || startIndex === -1) {
      return startIndex;
    }

    const categoryNames = {
      bugs: 'Bug Fixes',
      features: 'Features',
      docs: 'Documentation',
      refactor: 'Refactoring',
      test: 'Testing',
    };

    const categoryName = categoryNames[category];
    if (!categoryName) {
      return startIndex;
    }

    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ') && !lines[i].includes('Priority')) {
        break;
      }
      if (lines[i].includes(categoryName)) {
        return i;
      }
    }

    return startIndex;
  }

  findInsertionPoint(lines, sectionIndex) {
    if (sectionIndex === -1) {
      return lines.length;
    }

    // Find the next task line or section boundary
    for (let i = sectionIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('##') || lines[i].startsWith('---')) {
        return i;
      }
    }

    return lines.length;
  }
}
