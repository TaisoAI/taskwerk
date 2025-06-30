import { YamlTaskParser } from './yaml-task-parser.js';
import { TaskParser } from './task-parser.js';

/**
 * TaskWerk v1 to v2 Migration Utility
 *
 * Converts v1 format tasks (markdown only) to v2 format (YAML frontmatter + markdown)
 * with optional lazy migration (convert tasks only when modified).
 */
export class MigrationUtil {
  constructor() {
    this.v1Parser = new TaskParser();
    this.v2Parser = new YamlTaskParser();
    this.v2Parser.setV1Parser(this.v1Parser);
  }

  /**
   * Check if content needs migration from v1 to v2
   */
  needsMigration(content) {
    return !this.v2Parser.hasYamlFrontmatter(content) && content.trim().length > 0;
  }

  /**
   * Migrate entire file content from v1 to v2 format
   */
  migrateContent(content) {
    if (!this.needsMigration(content)) {
      return {
        content,
        migrated: false,
        tasksConverted: 0,
      };
    }

    try {
      // Parse tasks using v1 parser
      const v1Tasks = this.v1Parser.parseTasks(content);

      if (v1Tasks.length === 0) {
        return {
          content,
          migrated: false,
          tasksConverted: 0,
          warning: 'No tasks found to migrate',
        };
      }

      // Convert each task to v2 format
      const v2TaskBlocks = v1Tasks.map(task => this.convertTaskToV2(task));

      // Build v2 content with header
      const v2Content = this.buildV2Content(v2TaskBlocks, content);

      return {
        content: v2Content,
        migrated: true,
        tasksConverted: v1Tasks.length,
        originalFormat: 'v1',
        newFormat: 'v2',
      };
    } catch (error) {
      return {
        content,
        migrated: false,
        tasksConverted: 0,
        error: `Migration failed: ${error.message}`,
      };
    }
  }

  /**
   * Migrate a single task from v1 to v2 format (lazy migration)
   */
  migrateTask(task) {
    if (task.format === 'v2') {
      return task; // Already migrated
    }

    return this.convertTaskToV2(task);
  }

  /**
   * Convert a v1 task object to v2 format with enhanced metadata
   */
  convertTaskToV2(v1Task) {
    const now = new Date();

    // Build v2 task with enhanced schema
    const v2Task = {
      // Core fields (preserved from v1)
      id: v1Task.id,
      description: v1Task.description,
      status: v1Task.status,
      priority: v1Task.priority || 'medium',
      category: v1Task.category || null,

      // Enhanced timestamps
      created: v1Task.created || now,
      updated: null,

      // v2 enhanced fields (initialize empty)
      assignee: null,
      dependencies: [],
      estimated: null,
      timeline: [],

      // Git integration (initialize empty)
      git: { commits: [] },
      files: [],

      // Subtasks (initialize empty)
      subtasks: [],

      // Content (generate basic markdown structure)
      markdownContent: this.generateMarkdownContent(v1Task),

      // Format tracking
      format: 'v2',
    };

    // Handle status-specific fields from v1
    if (v1Task.status === 'completed' && v1Task.completedAt) {
      v2Task.completedAt = new Date(v1Task.completedAt);
      v2Task.timeline.push({
        completed: v2Task.completedAt.toISOString(),
      });

      if (v1Task.note) {
        v2Task.note = v1Task.note;
      }

      if (v1Task.filesChanged) {
        v2Task.filesChanged = v1Task.filesChanged;
        v2Task.files = v1Task.filesChanged;
      }
    }

    if (v1Task.status === 'archived' && v1Task.archivedAt) {
      v2Task.archivedAt = new Date(v1Task.archivedAt);
      v2Task.archiveReason = v1Task.archiveReason || 'Migrated from v1';
      v2Task.supersededBy = v1Task.supersededBy || null;
      v2Task.timeline.push({
        archived: v2Task.archivedAt.toISOString(),
      });

      if (v1Task.note) {
        v2Task.note = v1Task.note;
      }
    }

    return v2Task;
  }

  /**
   * Generate markdown content for v2 task from v1 task data
   */
  generateMarkdownContent(v1Task) {
    let content = `# ${v1Task.description}\n\n`;

    content += '**Description:**\n';
    content += `${v1Task.description}\n\n`;

    if (v1Task.category) {
      content += `**Category:** ${v1Task.category}\n\n`;
    }

    content += '**Acceptance Criteria:**\n';
    content += '- [ ] Implement solution\n';
    content += '- [ ] Add tests\n';
    content += '- [ ] Update documentation\n\n';

    if (v1Task.note || v1Task.archiveReason) {
      content += '**Notes:**\n';
      if (v1Task.note) {
        content += `${v1Task.note}\n`;
      }
      if (v1Task.archiveReason) {
        content += `Archive reason: ${v1Task.archiveReason}\n`;
      }
      content += '\n';
    }

    if (v1Task.status === 'completed' && v1Task.filesChanged) {
      content += '**Files Modified:**\n';
      v1Task.filesChanged.forEach(file => {
        content += `- ${file}\n`;
      });
      content += '\n';
    }

    content += '*Migrated from TaskWerk v1 format*\n';

    return content.trim();
  }

  /**
   * Build complete v2 content with header and task blocks
   */
  buildV2Content(taskBlocks, originalContent) {
    let content = '';

    // Add migration header comment
    content += '<!-- TaskWerk v2.0 Format -->\n';
    content += `<!-- Migrated from v1 format on ${new Date().toISOString()} -->\n\n`;

    // Extract any existing header comments from v1 content
    const v1Header = this.extractV1Header(originalContent);
    if (v1Header) {
      content += `<!-- Original v1 header: ${v1Header.replace(/\n/g, ' ')} -->\n\n`;
    }

    // Add task blocks
    content += taskBlocks.map(task => this.v2Parser.formatV2Task(task)).join('\n\n');

    return content;
  }

  /**
   * Extract header information from v1 content
   */
  extractV1Header(content) {
    const lines = content.split('\n');
    const headerLines = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed.startsWith('*')) {
        headerLines.push(trimmed);
      } else if (trimmed.length === 0) {
        continue; // Skip empty lines
      } else {
        break; // Stop at first content line
      }
    }

    return headerLines.join(' ');
  }

  /**
   * Create a migration plan without executing it
   */
  createMigrationPlan(content) {
    if (!this.needsMigration(content)) {
      return {
        needsMigration: false,
        reason: 'Content is already in v2 format',
      };
    }

    try {
      const v1Tasks = this.v1Parser.parseTasks(content);

      // If no tasks found, no migration needed
      if (v1Tasks.length === 0) {
        return {
          needsMigration: false,
          reason: 'No tasks found to migrate',
        };
      }

      return {
        needsMigration: true,
        tasksToMigrate: v1Tasks.length,
        tasks: v1Tasks.map(task => ({
          id: task.id,
          description: task.description,
          status: task.status,
          priority: task.priority,
          category: task.category,
        })),
        estimatedSize: this.estimateV2Size(v1Tasks),
        backupRecommended: true,
      };
    } catch (error) {
      return {
        needsMigration: false,
        error: `Could not analyze content: ${error.message}`,
      };
    }
  }

  /**
   * Estimate the size of v2 content after migration
   */
  estimateV2Size(tasks) {
    // Rough estimate: each task becomes ~500-800 chars in v2 format
    const avgTaskSize = 650;
    const headerSize = 200;

    return {
      estimatedBytes: tasks.length * avgTaskSize + headerSize,
      estimatedLines: tasks.length * 20,
      multiplier: '~3-4x larger than v1',
    };
  }

  /**
   * Validate migration result
   */
  validateMigration(originalContent, migratedContent) {
    try {
      // Parse both formats
      const v1Tasks = this.v1Parser.parseTasks(originalContent);
      const v2Tasks = this.v2Parser.parseTasks(migratedContent);

      const errors = [];

      // Check task count
      if (v1Tasks.length !== v2Tasks.length) {
        errors.push(`Task count mismatch: v1=${v1Tasks.length}, v2=${v2Tasks.length}`);
      }

      // Check each task was migrated correctly
      for (const v1Task of v1Tasks) {
        const v2Task = v2Tasks.find(t => t.id === v1Task.id);
        if (!v2Task) {
          errors.push(`Task ${v1Task.id} not found in migrated content`);
          continue;
        }

        if (v1Task.description !== v2Task.description) {
          errors.push(`Task ${v1Task.id} description mismatch`);
        }

        if (v1Task.status !== v2Task.status) {
          errors.push(`Task ${v1Task.id} status mismatch`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        v1TaskCount: v1Tasks.length,
        v2TaskCount: v2Tasks.length,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`],
      };
    }
  }
}
