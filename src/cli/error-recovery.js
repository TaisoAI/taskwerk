/**
 * TaskWerk v3 Error Recovery System
 *
 * Provides helpful recovery suggestions for common errors
 */

import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Error recovery suggestions based on error context
 */
export class ErrorRecovery {
  /**
   * Get recovery suggestions for a specific error
   */
  static getSuggestions(error, context = {}) {
    const suggestions = [];

    // Database-related errors
    if (error.type === 'DATABASE_NOT_FOUND' || error.code === 'E001') {
      suggestions.push({
        action: 'Initialize database',
        command: 'taskwerk init',
        description: 'Create a new TaskWerk database in the current directory',
      });

      if (existsSync('.taskwerk.db.backup')) {
        suggestions.push({
          action: 'Restore from backup',
          command: 'cp .taskwerk.db.backup .taskwerk.db',
          description: 'Restore database from the most recent backup',
        });
      }
    }

    if (error.type === 'DATABASE_LOCKED' || error.code === 'E002') {
      suggestions.push({
        action: 'Check for other processes',
        command: 'ps aux | grep taskwerk',
        description: 'Find other TaskWerk processes that might be using the database',
      });

      suggestions.push({
        action: 'Wait and retry',
        command: 'sleep 2 && taskwerk ' + (context.args || []).join(' '),
        description: 'Wait a moment and try the command again',
      });
    }

    if (error.type === 'DATABASE_CORRUPT' || error.code === 'E003') {
      const backupFiles = this.findBackupFiles();
      if (backupFiles.length > 0) {
        suggestions.push({
          action: 'Restore from backup',
          command: `cp ${backupFiles[0]} .taskwerk.db`,
          description: `Restore from backup: ${backupFiles[0]}`,
        });
      }

      suggestions.push({
        action: 'Reinitialize database',
        command: 'taskwerk init --force',
        description: 'Create a fresh database (WARNING: This will delete existing data)',
      });

      suggestions.push({
        action: 'Export and reimport',
        command:
          'taskwerk export --format json > tasks.json && taskwerk init --force && taskwerk import tasks.json',
        description: 'Try to export data and reimport into a fresh database',
      });
    }

    // Task-related errors
    if (error.type === 'TASK_NOT_FOUND' || error.code === 'E101') {
      suggestions.push({
        action: 'List all tasks',
        command: 'taskwerk list',
        description: 'View all available tasks to find the correct ID',
      });

      if (error.details?.taskId) {
        suggestions.push({
          action: 'Search for similar tasks',
          command: `taskwerk list | grep -i "${error.details.taskId}"`,
          description: 'Search for tasks with similar IDs',
        });
      }
    }

    // Configuration errors
    if (error.type === 'CONFIG_NOT_FOUND' || error.code === 'E201') {
      suggestions.push({
        action: 'Create default configuration',
        command: 'taskwerk config --reset',
        description: 'Create a new configuration file with default values',
      });

      suggestions.push({
        action: 'Migrate from v2',
        command: 'taskwerk config --migrate',
        description: 'Migrate existing v2 configuration to v3 format',
      });
    }

    if (error.type === 'CONFIG_INVALID' || error.code === 'E202') {
      suggestions.push({
        action: 'Validate configuration',
        command: 'taskwerk config --validate',
        description: 'Check configuration file for errors',
      });

      suggestions.push({
        action: 'Reset to defaults',
        command: 'taskwerk config --reset',
        description: 'Reset configuration to default values',
      });

      suggestions.push({
        action: 'Edit configuration',
        command: 'taskwerk config --edit',
        description: 'Open configuration in your editor',
      });
    }

    // File system errors
    if (error.type === 'FILE_NOT_FOUND' || error.code === 'E301') {
      if (error.details?.path) {
        const dir = join(error.details.path, '..');
        suggestions.push({
          action: 'Check directory contents',
          command: `ls -la "${dir}"`,
          description: 'List files in the directory to verify the path',
        });
      }

      suggestions.push({
        action: 'Check current directory',
        command: 'pwd',
        description: 'Verify you are in the correct directory',
      });
    }

    if (error.type === 'FILE_ACCESS_DENIED' || error.code === 'E302') {
      if (error.details?.path) {
        suggestions.push({
          action: 'Check file permissions',
          command: `ls -l "${error.details.path}"`,
          description: 'View current file permissions',
        });

        suggestions.push({
          action: 'Fix permissions',
          command: `chmod 644 "${error.details.path}"`,
          description: 'Make file readable and writable by owner',
        });
      }
    }

    // Command errors
    if (error.type === 'COMMAND_NOT_FOUND' || error.code === 'E401') {
      suggestions.push({
        action: 'View available commands',
        command: 'taskwerk --help',
        description: 'List all available TaskWerk commands',
      });

      if (context.command) {
        // Suggest similar commands
        const similar = this.findSimilarCommands(context.command);
        for (const cmd of similar) {
          suggestions.push({
            action: `Did you mean "${cmd}"?`,
            command: `taskwerk ${cmd}`,
            description: `Run the ${cmd} command instead`,
          });
        }
      }
    }

    if (error.type === 'INVALID_ARGUMENTS' || error.code === 'E402') {
      if (context.command) {
        suggestions.push({
          action: 'View command help',
          command: `taskwerk ${context.command} --help`,
          description: `Learn how to use the ${context.command} command`,
        });
      }
    }

    // Version-specific suggestions
    if (error.message && error.message.includes('v2')) {
      suggestions.push({
        action: 'Migrate to v3',
        command: 'taskwerk init && taskwerk config --migrate',
        description: 'Initialize v3 database and migrate configuration',
      });
    }

    return suggestions;
  }

  /**
   * Find backup files in the current directory
   */
  static findBackupFiles() {
    const backupPatterns = ['.taskwerk.db.backup', '.taskwerk.db.bak', 'taskwerk-backup-*.db'];

    const found = [];
    for (const pattern of backupPatterns) {
      if (pattern.includes('*')) {
        // Simple glob matching for backup files
        const prefix = pattern.split('*')[0];
        const suffix = pattern.split('*')[1];
        // This is simplified - in production, use proper glob
        if (existsSync(prefix + '20' + suffix)) {
          found.push(prefix + '20' + suffix);
        }
      } else if (existsSync(pattern)) {
        found.push(pattern);
      }
    }

    return found;
  }

  /**
   * Find commands similar to the given command
   */
  static findSimilarCommands(command) {
    const allCommands = [
      'init',
      'add',
      'list',
      'get',
      'start',
      'complete',
      'pause',
      'archive',
      'status',
      'context',
      'branch',
      'search',
      'stats',
      'recent',
      'stage',
      'commit',
      'import',
      'export',
      'config',
      'help',
    ];

    // Simple similarity check - in production, use proper string distance
    const similar = [];
    for (const cmd of allCommands) {
      if (cmd.startsWith(command[0]) || command.startsWith(cmd[0])) {
        if (Math.abs(cmd.length - command.length) <= 2) {
          similar.push(cmd);
        }
      }
    }

    return similar.slice(0, 3);
  }

  /**
   * Format suggestions for display
   */
  static formatSuggestions(suggestions) {
    if (suggestions.length === 0) {
      return '';
    }

    const lines = ['\n💡 Possible solutions:\n'];

    suggestions.forEach((suggestion, index) => {
      lines.push(`  ${index + 1}. ${suggestion.action}`);
      lines.push(`     $ ${suggestion.command}`);
      if (suggestion.description) {
        lines.push(`     ${suggestion.description}`);
      }
      lines.push('');
    });

    return lines.join('\n');
  }
}
