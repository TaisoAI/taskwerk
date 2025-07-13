import { Command } from 'commander';
import { TaskwerkAPI } from '../../api/taskwerk-api.js';
import { Logger } from '../../logging/logger.js';

export function taskShowCommand() {
  const show = new Command('show');

  show
    .description('Show task details')
    .argument('<id>', 'Task ID')
    .option('--format <format>', 'Output format (text, json)', 'text')
    .action(async (id, options) => {
      const logger = new Logger('task-show');
      
      try {
        const api = new TaskwerkAPI();
        
        // Get task details
        const task = api.getTask(id);
        const tags = api.getTaskTags(id);
        const timeline = api.getTaskTimeline(id);
        
        if (options.format === 'json') {
          console.log(JSON.stringify({ task, tags, timeline }, null, 2));
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
          'cancelled': '❌ Cancelled'
        };
        
        const priorityEmoji = {
          'low': '🔵 Low',
          'medium': '🟡 Medium', 
          'high': '🔴 High',
          'critical': '🚨 Critical'
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
        
        // Show recent timeline events
        if (timeline.length > 0) {
          console.log(`\n⏱️  Recent Activity:`);
          timeline.slice(0, 5).forEach(event => {
            const date = new Date(event.timestamp).toLocaleString();
            console.log(`  ${date} - ${event.action} by ${event.user}${event.note ? `: ${event.note}` : ''}`);
          });
          
          if (timeline.length > 5) {
            console.log(`  ... and ${timeline.length - 5} more events`);
          }
        }
        
        console.log('═'.repeat(50));
        
      } catch (error) {
        logger.error('Failed to show task', error);
        console.error('❌ Failed to show task:', error.message);
        process.exit(1);
      }
    });

  return show;
}
