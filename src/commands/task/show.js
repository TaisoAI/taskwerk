import { Command } from 'commander';
import { TaskwerkAPI } from '../../api/taskwerk-api.js';
import { Logger } from '../../logging/logger.js';

export function taskShowCommand() {
  const show = new Command('show');

  show
    .description('Show task details')
    .argument('<id>', 'Task ID')
    .option('--format <format>', 'Output format (text, json)', 'text')
    .addHelpText(
      'after',
      `
Examples:
  Basic usage:
    $ twrk showtask TASK-001                 # Show task by full ID
    $ twrk showtask 1                        # Use fuzzy matching
    $ twrk showtask task-1                   # Case-insensitive
    
  Different formats:
    $ twrk showtask 1 --format json          # JSON output for scripting
    $ twrk showtask TASK-001 --format text   # Default human-readable format
    
  Common workflows:
    $ twrk showtask 1 | grep Status          # Check task status
    $ twrk showtask 1 --format json | jq .  # Pretty print JSON
    
  Viewing subtasks:
    $ twrk showtask TASK-001.1               # Show subtask details
    $ twrk showtask 1.1                      # Fuzzy match subtask
    
Note: If task not found, similar task IDs will be suggested`
    )
    .action(async (id, options) => {
      const logger = new Logger('task-show');

      try {
        const api = new TaskwerkAPI();

        // Get task details
        const task = api.getTask(id);
        const tags = api.getTaskTags(id);
        const timeline = api.getTaskTimeline(id);
        const notes = api.getTaskNotes(id);

        if (options.format === 'json') {
          console.log(JSON.stringify({ task, tags, timeline, notes }, null, 2));
          return;
        }

        // Text format
        const statusEmoji = {
          'todo': '⏳ Todo',
          'in-progress': '🔄 In Progress',
          'in_progress': '🔄 In Progress',
          'blocked': '🚫 Blocked',
          'done': '✅ Done',
          'completed': '✅ Completed',
          'cancelled': '❌ Cancelled',
        };

        const priorityEmoji = {
          low: '🔵 Low',
          medium: '🟡 Medium',
          high: '🔴 High',
          critical: '🚨 Critical',
        };

        console.log(`\n📋 Task ${task.id}`);
        console.log('═'.repeat(50));
        console.log(`📝 Name: ${task.name}`);
        console.log(`🎯 Status: ${statusEmoji[task.status] || task.status}`);
        console.log(`⚡ Priority: ${priorityEmoji[task.priority] || task.priority}`);

        if (task.assignee) {
          console.log(`👤 Assignee: ${task.assignee}`);
        }

        if (task.description) {
          console.log(`📄 Description: ${task.description}`);
        }

        if (task.parent_id) {
          console.log(`📎 Parent: ${task.parent_id}`);
        }

        if (task.estimate) {
          console.log(`⏱️  Estimate: ${task.estimate} hours`);
        }

        if (task.progress > 0) {
          console.log(`📊 Progress: ${task.progress}%`);
        }

        if (task.due_date) {
          console.log(`📅 Due: ${new Date(task.due_date).toLocaleDateString()}`);
        }

        if (task.category) {
          console.log(`📂 Category: ${task.category}`);
        }

        if (tags.length > 0) {
          console.log(`🏷️  Tags: ${tags.join(', ')}`);
        }

        console.log(`⏰ Created: ${new Date(task.created_at).toLocaleString()}`);
        console.log(`🔄 Updated: ${new Date(task.updated_at).toLocaleString()}`);
        console.log(`👤 Created by: ${task.created_by}`);
        console.log(`👤 Updated by: ${task.updated_by}`);

        // Show metadata if present
        if (Object.keys(task.metadata).length > 0) {
          console.log(`\n📊 Metadata:`);
          for (const [key, value] of Object.entries(task.metadata)) {
            console.log(`  ${key}: ${value}`);
          }
        }

        // Show context if present
        if (Object.keys(task.context).length > 0) {
          console.log(`\n🔗 Context:`);
          for (const [key, value] of Object.entries(task.context)) {
            console.log(`  ${key}: ${value}`);
          }
        }

        // Show notes
        if (notes.length > 0) {
          console.log(`\n💬 Notes:`);
          notes.forEach(note => {
            const date = new Date(note.created_at).toLocaleString();
            console.log(`  [${date}] @${note.user}: ${note.note}`);
            if (note.content) {
              // Indent multiline content
              const indentedContent = note.content
                .split('\n')
                .map(line => `    ${line}`)
                .join('\n');
              console.log(indentedContent);
            }
          });
        }

        // Show subtasks
        const subtasks = api.getSubtasks(task.id);
        if (subtasks.length > 0) {
          console.log(`\n📋 Subtasks:`);
          subtasks.forEach(subtask => {
            const statusIcon =
              {
                'todo': '⏳',
                'in-progress': '🔄',
                'in_progress': '🔄',
                'blocked': '🚫',
                'done': '✅',
                'completed': '✅',
                'cancelled': '❌',
              }[subtask.status] || '⏳';
            console.log(`  ${statusIcon} ${subtask.id} - ${subtask.name}`);
          });
        }

        // Show parent task if this is a subtask
        if (task.parent_id) {
          try {
            const parent = api.getParentTask(task.id);
            if (parent) {
              console.log(`\n📎 Parent Task:`);
              console.log(`  ${parent.id} - ${parent.name}`);
            }
          } catch (err) {
            // Parent might be deleted
          }
        }

        // Show recent timeline events
        if (timeline.length > 0) {
          console.log(`\n⏱️  Recent Activity:`);
          timeline.slice(0, 5).forEach(event => {
            const date = new Date(event.timestamp).toLocaleString();
            console.log(
              `  ${date} - ${event.action} by ${event.user}${event.note ? `: ${event.note}` : ''}`
            );
          });

          if (timeline.length > 5) {
            console.log(`  ... and ${timeline.length - 5} more events`);
          }
        }

        console.log('═'.repeat(50));
      } catch (error) {
        logger.error('Failed to show task', error);
        // For TaskNotFoundError, the message already contains suggestions
        if (error.code === 'TASK_NOT_FOUND') {
          console.error(`❌ ${error.message}`);
        } else {
          console.error('❌ Failed to show task:', error.message);
        }
        process.exit(1);
      }
    });

  return show;
}
