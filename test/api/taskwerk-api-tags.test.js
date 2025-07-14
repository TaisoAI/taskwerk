import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from '../helpers/database-test-helper.js';
import { TaskwerkAPI } from '../../src/api/taskwerk-api.js';

describe('TaskwerkAPI - Tag Filtering', () => {
  let testSetup;
  let api;

  beforeEach(async () => {
    testSetup = createTestDatabase();
    api = new TaskwerkAPI(testSetup.database);
    
    // Create test tasks with different tags
    const task1 = await api.createTask({ 
      name: 'Backend task',
      created_by: 'test'
    });
    await api.addTaskTags(task1.id, ['backend', 'urgent'], 'test');
    
    const task2 = await api.createTask({ 
      name: 'Frontend task',
      created_by: 'test'
    });
    await api.addTaskTags(task2.id, ['frontend', 'urgent'], 'test');
    
    const task3 = await api.createTask({ 
      name: 'Database task',
      created_by: 'test'
    });
    await api.addTaskTags(task3.id, ['backend', 'database'], 'test');
    
    await api.createTask({ 
      name: 'Task without tags',
      created_by: 'test'
    });
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should filter tasks by single tag', () => {
    const tasks = api.listTasks({ tags: ['backend'] });
    
    expect(tasks).toHaveLength(2);
    expect(tasks.map(t => t.name)).toContain('Backend task');
    expect(tasks.map(t => t.name)).toContain('Database task');
  });

  it('should filter tasks by multiple tags (OR logic)', () => {
    const tasks = api.listTasks({ tags: ['frontend', 'database'] });
    
    expect(tasks).toHaveLength(2);
    expect(tasks.map(t => t.name)).toContain('Frontend task');
    expect(tasks.map(t => t.name)).toContain('Database task');
  });

  it('should filter by tag and status', () => {
    // Update one task's status
    const tasks = api.listTasks({});
    const backendTask = tasks.find(t => t.name === 'Backend task');
    api.updateTask(backendTask.id, { status: 'done' }, 'test');
    
    // Filter by tag and status
    const filteredTasks = api.listTasks({ 
      tags: ['backend'], 
      status: 'todo' 
    });
    
    expect(filteredTasks).toHaveLength(1);
    expect(filteredTasks[0].name).toBe('Database task');
  });

  it('should return empty array when no tasks match tags', () => {
    const tasks = api.listTasks({ tags: ['nonexistent'] });
    
    expect(tasks).toHaveLength(0);
  });

  it('should handle empty tags array', () => {
    const tasks = api.listTasks({ tags: [] });
    
    // Should return all tasks when tags array is empty
    expect(tasks).toHaveLength(4);
  });

  it('should not return duplicates when task has multiple matching tags', async () => {
    // Create a task with multiple tags that would match
    const task = await api.createTask({ name: 'Multi-tag task', created_by: 'test' });
    await api.addTaskTags(task.id, ['backend', 'frontend', 'urgent'], 'test');
    
    const tasks = api.listTasks({ tags: ['backend', 'frontend'] });
    
    // Should use DISTINCT to avoid duplicates
    const multiTagTask = tasks.filter(t => t.name === 'Multi-tag task');
    expect(multiTagTask).toHaveLength(1);
  });
});