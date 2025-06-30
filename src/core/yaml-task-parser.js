import yaml from 'js-yaml';

/**
 * TaskWerk v2.0 YAML Frontmatter Parser
 *
 * Supports both v1 (markdown-only) and v2 (YAML frontmatter + markdown) formats
 * with graceful error recovery and format detection.
 */
export class YamlTaskParser {
  constructor() {
    this.v1Parser = null; // Will be injected to avoid circular dependency
  }

  /**
   * Set the v1 parser for backward compatibility
   */
  setV1Parser(parser) {
    this.v1Parser = parser;
  }

  /**
   * Parse task content, automatically detecting v1 vs v2 format
   */
  parseTasks(content) {
    try {
      // Detect format by looking for YAML frontmatter
      if (this.hasYamlFrontmatter(content)) {
        return this.parseV2Tasks(content);
      } else {
        // Fall back to v1 parser
        return this.parseV1Tasks(content);
      }
    } catch (error) {
      console.warn('Task parsing failed, using error recovery:', error.message);
      return this.recoverFromParsingError(content);
    }
  }

  /**
   * Check if content contains YAML frontmatter
   */
  hasYamlFrontmatter(content) {
    const lines = content.split('\n');

    // Look for any line that is exactly '---' (YAML frontmatter delimiter)
    for (const line of lines) {
      if (line.trim() === '---') {
        return true;
      }
    }

    return false;
  }

  /**
   * Parse v2 format tasks with YAML frontmatter
   */
  parseV2Tasks(content) {
    const tasks = [];
    const taskBlocks = this.splitIntoTaskBlocks(content);

    for (const block of taskBlocks) {
      try {
        const task = this.parseV2TaskBlock(block);
        if (task) {
          tasks.push(task);
        }
      } catch (error) {
        console.warn(`Skipping malformed task block: ${error.message}`);
        // Continue parsing other tasks (error recovery)
      }
    }

    return tasks;
  }

  /**
   * Parse v1 format tasks using legacy parser
   */
  parseV1Tasks(content) {
    if (!this.v1Parser) {
      throw new Error('v1 parser not available for backward compatibility');
    }
    return this.v1Parser.parseTasks(content);
  }

  /**
   * Split content into individual task blocks (each with frontmatter + markdown)
   */
  splitIntoTaskBlocks(content) {
    const blocks = [];
    const lines = content.split('\n');
    let currentBlock = [];
    let inFrontmatter = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === '---') {
        if (inFrontmatter) {
          // End of frontmatter
          currentBlock.push(line);
          inFrontmatter = false;

          // Collect markdown content until next frontmatter or end
          let j = i + 1;
          while (j < lines.length && lines[j].trim() !== '---') {
            currentBlock.push(lines[j]);
            j++;
          }

          // We have a complete task block
          if (currentBlock.length > 0) {
            blocks.push(currentBlock.join('\n'));
          }

          // Reset for next block
          currentBlock = [];
          i = j - 1; // -1 because loop will increment
        } else {
          // Start of new frontmatter block
          // Save previous block if it exists and isn't just comments
          if (currentBlock.length > 0) {
            const blockContent = currentBlock.join('\n').trim();
            if (blockContent && !blockContent.startsWith('<!--')) {
              blocks.push(blockContent);
            }
          }

          // Start new block
          currentBlock = [line];
          inFrontmatter = true;
        }
      } else {
        // Regular content line
        currentBlock.push(line);
      }
    }

    // Add the last block if it's a valid task block
    if (currentBlock.length > 0) {
      const blockContent = currentBlock.join('\n').trim();
      if (blockContent && !blockContent.startsWith('<!--')) {
        blocks.push(blockContent);
      }
    }

    return blocks.filter(block => {
      const trimmed = block.trim();
      return trimmed.length > 0 && trimmed.includes('---') && !trimmed.startsWith('<!--');
    });
  }

  /**
   * Parse a single v2 task block with YAML frontmatter
   */
  parseV2TaskBlock(block) {
    const parts = this.separateFrontmatterAndContent(block);
    if (!parts) {
      return null;
    }

    const { frontmatter, content } = parts;

    // Parse YAML frontmatter
    let metadata;
    try {
      metadata = yaml.load(frontmatter);
    } catch (error) {
      throw new Error(`Invalid YAML frontmatter: ${error.message}`);
    }

    // Validate required fields
    if (!metadata.id) {
      throw new Error('Task ID is required in frontmatter');
    }

    // Extract description from markdown content or frontmatter
    const description = this.extractDescription(content, metadata);

    // Build task object with v2 schema
    const task = {
      // Core fields
      id: metadata.id,
      description,
      status: this.normalizeStatus(metadata.state || metadata.status || 'todo'),
      priority: metadata.priority || 'medium',
      category: metadata.category || null,

      // Timestamps
      created: metadata.created ? new Date(metadata.created) : new Date(),
      updated: metadata.updated ? new Date(metadata.updated) : null,

      // v2 enhanced fields
      assignee: metadata.assignee || null,
      dependencies: metadata.dependencies || [],
      estimated: metadata.estimated || null,
      timeline: metadata.timeline || [],

      // Git integration
      git: metadata.git || { commits: [] },
      files: metadata.files || [],

      // Subtasks
      subtasks: metadata.subtasks || [],

      // Content
      markdownContent: content,

      // Format version for tracking
      format: 'v2',
    };

    // Handle completed tasks
    if (task.status === 'completed') {
      task.completedAt =
        metadata.completedAt ||
        (metadata.timeline && metadata.timeline.find(t => t.completed)) ||
        task.updated ||
        new Date();
      task.note = metadata.note || null;
      task.filesChanged = metadata.filesChanged || metadata.files || [];
    }

    // Handle archived tasks
    if (task.status === 'archived') {
      task.archivedAt =
        metadata.archivedAt ||
        (metadata.timeline && metadata.timeline.find(t => t.archived)) ||
        task.updated ||
        new Date();
      task.archiveReason = metadata.archiveReason || 'No reason provided';
      task.supersededBy = metadata.supersededBy || null;
      task.note = metadata.note || null;
    }

    return task;
  }

  /**
   * Separate YAML frontmatter from markdown content
   */
  separateFrontmatterAndContent(block) {
    const lines = block.split('\n');

    if (lines[0].trim() !== '---') {
      return null;
    }

    let frontmatterEnd = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        frontmatterEnd = i;
        break;
      }
    }

    if (frontmatterEnd === -1) {
      throw new Error('Unterminated YAML frontmatter block');
    }

    const frontmatter = lines.slice(1, frontmatterEnd).join('\n');
    const content = lines
      .slice(frontmatterEnd + 1)
      .join('\n')
      .trim();

    return { frontmatter, content };
  }

  /**
   * Extract description from markdown content or fallback to frontmatter
   */
  extractDescription(content, metadata) {
    // Try to extract from first markdown header
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return trimmed.substring(2).trim();
      }
    }

    // Try to extract from task line in content (v1 compatibility)
    for (const line of lines) {
      const taskMatch = line.match(/^[-*]\s*\[[^\]]*\]\s*\*\*[^*]+\*\*\s*(.+)$/);
      if (taskMatch) {
        return taskMatch[1].trim();
      }
    }

    // Fallback to frontmatter description
    return metadata.description || metadata.title || 'No description provided';
  }

  /**
   * Normalize status values between v1 and v2 formats
   */
  normalizeStatus(status) {
    const statusMap = {
      'todo': 'todo',
      'in_progress': 'in_progress',
      'in-progress': 'in_progress',
      'progress': 'in_progress',
      'completed': 'completed',
      'complete': 'completed',
      'done': 'completed',
      'blocked': 'blocked',
      'block': 'blocked',
      'archived': 'archived',
      'archive': 'archived',
    };

    return statusMap[status.toLowerCase()] || 'todo';
  }

  /**
   * Error recovery: attempt to parse what we can and skip broken tasks
   */
  recoverFromParsingError(content) {
    console.warn('Attempting error recovery parsing...');

    try {
      // Try v1 parser as fallback
      if (this.v1Parser) {
        return this.v1Parser.parseTasks(content);
      }
    } catch (v1Error) {
      console.warn('v1 fallback also failed:', v1Error.message);
    }

    // Last resort: return empty array but log the issue
    console.error('All parsing methods failed. Tasks file may be corrupted.');
    return [];
  }

  /**
   * Convert v2 task back to YAML frontmatter + markdown format
   */
  formatV2Task(task) {
    const frontmatter = this.buildFrontmatter(task);
    const markdown = this.buildMarkdownContent(task);

    return `---\n${frontmatter}\n---\n\n${markdown}`;
  }

  /**
   * Build YAML frontmatter from task object
   */
  buildFrontmatter(task) {
    const metadata = {
      id: task.id,
      created: task.created ? task.created.toISOString() : new Date().toISOString(),
      state: task.status,
      priority: task.priority || 'medium',
    };

    // Add optional fields only if they have values
    if (task.category) {
      metadata.category = task.category;
    }
    if (task.assignee) {
      metadata.assignee = task.assignee;
    }
    if (task.dependencies && task.dependencies.length > 0) {
      metadata.dependencies = task.dependencies;
    }
    if (task.estimated) {
      metadata.estimated = task.estimated;
    }
    if (task.timeline && task.timeline.length > 0) {
      metadata.timeline = task.timeline;
    }
    if (task.git && (task.git.commits || task.git.branch)) {
      metadata.git = task.git;
    }
    if (task.files && task.files.length > 0) {
      metadata.files = task.files;
    }
    if (task.subtasks && task.subtasks.length > 0) {
      metadata.subtasks = task.subtasks;
    }

    // Status-specific fields
    if (task.status === 'completed') {
      if (task.completedAt) {
        metadata.completedAt = task.completedAt.toISOString
          ? task.completedAt.toISOString()
          : task.completedAt;
      }
      if (task.note) {
        metadata.note = task.note;
      }
      if (task.filesChanged && task.filesChanged.length > 0) {
        metadata.filesChanged = task.filesChanged;
      }
    }

    if (task.status === 'archived') {
      if (task.archivedAt) {
        metadata.archivedAt = task.archivedAt.toISOString
          ? task.archivedAt.toISOString()
          : task.archivedAt;
      }
      if (task.archiveReason) {
        metadata.archiveReason = task.archiveReason;
      }
      if (task.supersededBy) {
        metadata.supersededBy = task.supersededBy;
      }
      if (task.note) {
        metadata.note = task.note;
      }
    }

    return yaml.dump(metadata, {
      indent: 2,
      lineWidth: 100,
      noRefs: true,
    });
  }

  /**
   * Build markdown content from task object
   */
  buildMarkdownContent(task) {
    let content = `# ${task.description}\n\n`;

    // Use stored markdown content if available
    if (task.markdownContent && task.markdownContent.trim()) {
      const lines = task.markdownContent.split('\n');
      // Skip the first line if it's already a header with the same description
      const firstLine = lines[0]?.trim();
      if (firstLine.startsWith('# ') && firstLine.substring(2).trim() === task.description) {
        content += lines.slice(1).join('\n');
      } else {
        content += task.markdownContent;
      }
    } else {
      // Generate basic content structure
      content += '**Description:**\n\n';
      content += '**Acceptance Criteria:**\n\n';
      content += '**Notes:**\n';
    }

    return content.trim();
  }

  /**
   * Validate task schema for v2 format
   */
  validateV2Task(task) {
    const errors = [];

    // Required fields
    if (!task.id) {
      errors.push('Task ID is required');
    }
    if (!task.description) {
      errors.push('Task description is required');
    }

    // Valid status
    const validStatuses = ['todo', 'in_progress', 'completed', 'blocked', 'archived'];
    if (!validStatuses.includes(task.status)) {
      errors.push(`Invalid status: ${task.status}`);
    }

    // Valid priority
    const validPriorities = ['high', 'medium', 'low'];
    if (task.priority && !validPriorities.includes(task.priority)) {
      errors.push(`Invalid priority: ${task.priority}`);
    }

    // Dependencies format
    if (task.dependencies && !Array.isArray(task.dependencies)) {
      errors.push('Dependencies must be an array');
    }

    // Subtasks format
    if (task.subtasks && !Array.isArray(task.subtasks)) {
      errors.push('Subtasks must be an array');
    }

    return errors;
  }
}
