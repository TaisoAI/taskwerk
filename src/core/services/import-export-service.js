/**
 * Import/Export Service
 * 
 * @description Handles data import and export in various formats
 * @module taskwerk/core/services/import-export-service
 */

import yaml from 'yaml';
import fs from 'fs/promises';
import path from 'path';
import { TaskStatus, Priority, NoteType } from '../constants.js';

export default class ImportExportService {
  constructor(database) {
    this.db = database;
  }

  /**
   * Export tasks to various formats
   * @param {Object} options - Export options
   * @param {string} options.format - Export format (json, yaml, markdown, csv)
   * @param {Object} options.filters - Task filters (same as listTasks)
   * @param {boolean} options.includeNotes - Include task notes
   * @param {boolean} options.includeHistory - Include task history
   * @param {boolean} options.includeTags - Include tags
   * @returns {string} Exported data
   */
  async exportTasks(options = {}) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const format = options.format || 'json';
    
    // Get tasks with filters
    const tasks = await this._getTasksForExport(options.filters || {});
    
    // Enrich tasks with additional data if requested
    for (const task of tasks) {
      if (options.includeNotes) {
        task.notes_list = await this._getTaskNotes(task.id);
      }
      
      if (options.includeHistory) {
        task.history = await this._getTaskHistory(task.id);
      }
      
      if (options.includeTags !== false) { // Include by default
        task.tags = await this._getTaskTags(task.id);
      }
      
      // Get child tasks
      task.children = await this._getChildTasks(task.id);
    }

    // Convert to requested format
    switch (format.toLowerCase()) {
      case 'json':
        return this._exportToJSON(tasks);
      case 'yaml':
        return this._exportToYAML(tasks);
      case 'markdown':
      case 'md':
        return this._exportToMarkdown(tasks);
      case 'csv':
        return this._exportToCSV(tasks);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Import tasks from various formats
   * @param {string} data - Data to import
   * @param {Object} options - Import options
   * @param {string} options.format - Data format (json, yaml, markdown, csv)
   * @param {string} options.mode - Import mode (merge, replace, skip)
   * @param {boolean} options.preserveIds - Preserve task IDs
   * @param {Object} options.defaults - Default values for imported tasks
   * @returns {Object} Import results
   */
  async importTasks(data, options = {}) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const format = options.format || 'json';
    const mode = options.mode || 'merge';
    
    // Parse data based on format
    let tasks;
    switch (format.toLowerCase()) {
      case 'json':
        tasks = this._parseJSON(data);
        break;
      case 'yaml':
        tasks = this._parseYAML(data);
        break;
      case 'markdown':
      case 'md':
        tasks = this._parseMarkdown(data);
        break;
      case 'csv':
        tasks = this._parseCSV(data);
        break;
      default:
        throw new Error(`Unsupported import format: ${format}`);
    }

    // Validate and prepare tasks
    const prepared = this._prepareTasks(tasks, options);
    
    // Import tasks
    const results = {
      imported: 0,
      skipped: 0,
      errors: [],
      taskMap: {} // Maps old IDs to new IDs
    };

    // Start transaction
    const transaction = this.db.transaction(() => {
      for (const task of prepared) {
        try {
          const result = this._importTask(task, mode, options);
          if (result.imported) {
            results.imported++;
            if (task.id) {
              results.taskMap[task.id] = result.newId;
            }
          } else {
            results.skipped++;
          }
        } catch (err) {
          results.errors.push({
            task: task.name || task.id,
            error: err.message
          });
        }
      }
      
      // Fix parent relationships using taskMap
      this._fixParentRelationships(results.taskMap);
    });

    // Execute transaction
    transaction();

    return results;
  }

  /**
   * Export to file
   * @param {string} filePath - File path
   * @param {Object} options - Export options
   */
  async exportToFile(filePath, options = {}) {
    const ext = path.extname(filePath).toLowerCase();
    
    // Infer format from extension if not specified
    if (!options.format) {
      switch (ext) {
        case '.json':
          options.format = 'json';
          break;
        case '.yaml':
        case '.yml':
          options.format = 'yaml';
          break;
        case '.md':
        case '.markdown':
          options.format = 'markdown';
          break;
        case '.csv':
          options.format = 'csv';
          break;
        default:
          throw new Error(`Cannot infer format from extension: ${ext}`);
      }
    }

    const data = await this.exportTasks(options);
    await fs.writeFile(filePath, data, 'utf8');
    
    return {
      path: filePath,
      format: options.format,
      size: Buffer.byteLength(data, 'utf8')
    };
  }

  /**
   * Import from file
   * @param {string} filePath - File path
   * @param {Object} options - Import options
   */
  async importFromFile(filePath, options = {}) {
    const ext = path.extname(filePath).toLowerCase();
    
    // Infer format from extension if not specified
    if (!options.format) {
      switch (ext) {
        case '.json':
          options.format = 'json';
          break;
        case '.yaml':
        case '.yml':
          options.format = 'yaml';
          break;
        case '.md':
        case '.markdown':
          options.format = 'markdown';
          break;
        case '.csv':
          options.format = 'csv';
          break;
        default:
          throw new Error(`Cannot infer format from extension: ${ext}`);
      }
    }

    const data = await fs.readFile(filePath, 'utf8');
    return this.importTasks(data, options);
  }

  /**
   * Create a backup of all data
   * @param {string} backupPath - Backup directory path
   * @returns {Object} Backup info
   */
  async createBackup(backupPath) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(backupPath, `taskwerk-backup-${timestamp}`);
    
    // Create backup directory
    await fs.mkdir(backupDir, { recursive: true });
    
    // Export all data
    const allData = await this.exportTasks({
      format: 'json',
      includeNotes: true,
      includeHistory: true,
      includeTags: true,
      filters: { include_archived: true }
    });

    // Write main data file
    const dataFile = path.join(backupDir, 'tasks.json');
    await fs.writeFile(dataFile, allData);

    // Export schema version
    const schemaInfo = this._getSchemaInfo();
    await fs.writeFile(
      path.join(backupDir, 'schema.json'),
      JSON.stringify(schemaInfo, null, 2)
    );

    // Create backup info
    const backupInfo = {
      version: '1.0',
      created_at: new Date().toISOString(),
      taskwerk_version: await this._getTaskwerkVersion(),
      stats: {
        tasks: JSON.parse(allData).length,
        size: Buffer.byteLength(allData, 'utf8')
      }
    };

    await fs.writeFile(
      path.join(backupDir, 'backup.json'),
      JSON.stringify(backupInfo, null, 2)
    );

    return {
      path: backupDir,
      ...backupInfo
    };
  }

  /**
   * Restore from backup
   * @param {string} backupPath - Backup directory path
   * @param {Object} options - Restore options
   */
  async restoreBackup(backupPath, options = {}) {
    // Read backup info
    const backupInfo = JSON.parse(
      await fs.readFile(path.join(backupPath, 'backup.json'), 'utf8')
    );

    // Read tasks data
    const tasksData = await fs.readFile(
      path.join(backupPath, 'tasks.json'),
      'utf8'
    );

    // Import with replace mode by default
    const importOptions = {
      format: 'json',
      mode: options.mode || 'replace',
      preserveIds: true,
      ...options
    };

    return this.importTasks(tasksData, importOptions);
  }

  // Private helper methods

  async _getTasksForExport(filters) {
    const taskService = await this._getTaskService();
    return taskService.listTasks(filters);
  }

  async _getTaskNotes(taskId) {
    const stmt = this.db.prepare(`
      SELECT id, content, created_at, created_by, note_type
      FROM task_notes
      WHERE task_id = ?
      ORDER BY created_at
    `);
    return stmt.all(taskId);
  }

  async _getTaskHistory(taskId) {
    const stmt = this.db.prepare(`
      SELECT field_name, old_value, new_value, changed_at, change_type
      FROM task_history
      WHERE task_id = ?
      ORDER BY changed_at
    `);
    return stmt.all(taskId);
  }

  async _getTaskTags(taskId) {
    const stmt = this.db.prepare(`
      SELECT t.name
      FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ?
    `);
    return stmt.all(taskId).map(row => row.name);
  }

  async _getChildTasks(parentId) {
    const stmt = this.db.prepare(`
      SELECT string_id
      FROM tasks
      WHERE parent_id = ?
    `);
    return stmt.all(parentId).map(row => row.string_id);
  }

  _exportToJSON(tasks) {
    return JSON.stringify(tasks, null, 2);
  }

  _exportToYAML(tasks) {
    return yaml.stringify(tasks);
  }

  _exportToMarkdown(tasks) {
    const lines = ['# Taskwerk Export', ''];
    
    for (const task of tasks) {
      lines.push(`## ${task.string_id}: ${task.name}`);
      lines.push('');
      
      if (task.description) {
        lines.push(`**Description:** ${task.description}`);
        lines.push('');
      }
      
      lines.push(`- **Status:** ${task.status}`);
      lines.push(`- **Priority:** ${task.priority}`);
      lines.push(`- **Created:** ${task.created_at}`);
      
      if (task.assignee) {
        lines.push(`- **Assignee:** ${task.assignee}`);
      }
      
      if (task.tags && task.tags.length > 0) {
        lines.push(`- **Tags:** ${task.tags.join(', ')}`);
      }
      
      if (task.notes_list && task.notes_list.length > 0) {
        lines.push('');
        lines.push('### Notes');
        for (const note of task.notes_list) {
          lines.push(`- ${note.created_at}: ${note.content}`);
        }
      }
      
      lines.push('');
      lines.push('---');
      lines.push('');
    }
    
    return lines.join('\n');
  }

  _exportToCSV(tasks) {
    const headers = [
      'ID', 'Name', 'Description', 'Status', 'Priority', 
      'Assignee', 'Created', 'Updated', 'Tags'
    ];
    
    const rows = [headers.join(',')];
    
    for (const task of tasks) {
      const row = [
        task.string_id,
        `"${task.name.replace(/"/g, '""')}"`,
        `"${(task.description || '').replace(/"/g, '""')}"`,
        task.status,
        task.priority,
        task.assignee || '',
        task.created_at,
        task.updated_at,
        `"${(task.tags || []).join(', ')}"`
      ];
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }

  _parseJSON(data) {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (err) {
      throw new Error(`Invalid JSON: ${err.message}`);
    }
  }

  _parseYAML(data) {
    try {
      const parsed = yaml.parse(data);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (err) {
      throw new Error(`Invalid YAML: ${err.message}`);
    }
  }

  _parseMarkdown(data) {
    const tasks = [];
    const lines = data.split('\n');
    let currentTask = null;
    let inNotes = false;
    
    for (const line of lines) {
      // Task header
      const taskMatch = line.match(/^##\s+(?:(TASK-\d+):\s+)?(.+)$/);
      if (taskMatch) {
        if (currentTask) {
          tasks.push(currentTask);
        }
        currentTask = {
          string_id: taskMatch[1],
          name: taskMatch[2],
          notes_list: []
        };
        inNotes = false;
        continue;
      }
      
      if (!currentTask) continue;
      
      // Metadata fields
      const fieldMatch = line.match(/^-?\s*\*\*(.+?):\*\*\s*(.+)$/);
      if (fieldMatch) {
        const [, field, value] = fieldMatch;
        switch (field.toLowerCase()) {
          case 'description':
            currentTask.description = value;
            break;
          case 'status':
            currentTask.status = value.toLowerCase();
            break;
          case 'priority':
            currentTask.priority = value.toLowerCase();
            break;
          case 'assignee':
            currentTask.assignee = value;
            break;
          case 'tags':
            currentTask.tags = value.split(',').map(t => t.trim());
            break;
        }
        continue;
      }
      
      // Notes section
      if (line.trim() === '### Notes') {
        inNotes = true;
        continue;
      }
      
      // Note entry
      if (inNotes && line.startsWith('- ')) {
        const noteMatch = line.match(/^-\s*(.+?):\s*(.+)$/);
        if (noteMatch) {
          currentTask.notes_list.push({
            created_at: noteMatch[1],
            content: noteMatch[2]
          });
        }
      }
    }
    
    if (currentTask) {
      tasks.push(currentTask);
    }
    
    return tasks;
  }

  _parseCSV(data) {
    const lines = data.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const tasks = [];
    
    // Parse rows
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCSVLine(lines[i]);
      const task = {};
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const value = values[j]?.trim();
        
        if (!value) continue;
        
        switch (header) {
          case 'id':
            task.string_id = value;
            break;
          case 'name':
          case 'description':
          case 'status':
          case 'priority':
          case 'assignee':
            task[header] = value;
            break;
          case 'tags':
            task.tags = value.split(',').map(t => t.trim());
            break;
          case 'created':
            task.created_at = value;
            break;
          case 'updated':
            task.updated_at = value;
            break;
        }
      }
      
      if (task.name) {
        tasks.push(task);
      }
    }
    
    return tasks;
  }

  _parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current);
    return values;
  }

  _prepareTasks(tasks, options) {
    const prepared = [];
    
    for (const task of tasks) {
      // Apply defaults
      const preparedTask = {
        ...options.defaults,
        ...task
      };
      
      // Validate required fields
      if (!preparedTask.name) {
        throw new Error('Task name is required');
      }
      
      // Normalize status and priority
      if (preparedTask.status) {
        preparedTask.status = preparedTask.status.toLowerCase();
        if (!Object.values(TaskStatus).includes(preparedTask.status)) {
          preparedTask.status = TaskStatus.TODO;
        }
      }
      
      if (preparedTask.priority) {
        preparedTask.priority = preparedTask.priority.toLowerCase();
        if (!Object.values(Priority).includes(preparedTask.priority)) {
          preparedTask.priority = Priority.MEDIUM;
        }
      }
      
      prepared.push(preparedTask);
    }
    
    return prepared;
  }

  _importTask(task, mode, options) {
    const result = { imported: false, newId: null };
    
    // Check if task exists
    let existing = null;
    if (task.string_id && options.preserveIds) {
      const stmt = this.db.prepare('SELECT * FROM tasks WHERE string_id = ?');
      existing = stmt.get(task.string_id);
    }
    
    if (existing) {
      switch (mode) {
        case 'skip':
          return result;
        case 'merge':
          // Update existing task
          this._updateExistingTask(existing.id, task);
          result.imported = true;
          result.newId = existing.id;
          break;
        case 'replace':
          // Delete and recreate
          this.db.prepare('DELETE FROM tasks WHERE id = ?').run(existing.id);
          result.newId = this._createNewTask(task, options);
          result.imported = true;
          break;
      }
    } else {
      // Create new task
      result.newId = this._createNewTask(task, options);
      result.imported = true;
    }
    
    // Import notes if present
    if (task.notes_list && result.newId) {
      for (const note of task.notes_list) {
        this._importNote(result.newId, note);
      }
    }
    
    // Import tags if present
    if (task.tags && result.newId) {
      this._importTags(result.newId, task.tags);
    }
    
    return result;
  }

  _createNewTask(task, options) {
    const taskService = this._getTaskServiceSync();
    
    // Remove fields that shouldn't be set directly
    const taskData = { ...task };
    delete taskData.id;
    delete taskData.notes_list;
    delete taskData.history;
    delete taskData.children;
    
    if (!options.preserveIds) {
      delete taskData.string_id;
    }
    
    const created = taskService.createTask(taskData);
    return created.id;
  }

  _updateExistingTask(taskId, updates) {
    const taskService = this._getTaskServiceSync();
    
    // Remove fields that shouldn't be updated
    const updateData = { ...updates };
    delete updateData.id;
    delete updateData.string_id;
    delete updateData.notes_list;
    delete updateData.history;
    delete updateData.children;
    delete updateData.created_at;
    
    taskService.updateTask(taskId, updateData);
  }

  _importNote(taskId, note) {
    const stmt = this.db.prepare(`
      INSERT INTO task_notes (task_id, content, created_at, created_by, note_type)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      taskId,
      note.content,
      note.created_at || new Date().toISOString(),
      note.created_by || 'import',
      note.note_type || NoteType.COMMENT
    );
  }

  _importTags(taskId, tags) {
    const insertTag = this.db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const getTag = this.db.prepare('SELECT id FROM tags WHERE name = ?');
    const linkTag = this.db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)');
    
    for (const tag of tags) {
      insertTag.run(tag);
      const { id: tagId } = getTag.get(tag);
      linkTag.run(taskId, tagId);
    }
  }

  _fixParentRelationships(taskMap) {
    // Update parent_id references using the task map
    for (const [oldId, newId] of Object.entries(taskMap)) {
      const stmt = this.db.prepare(`
        UPDATE tasks 
        SET parent_id = ? 
        WHERE parent_id = ?
      `);
      stmt.run(newId, oldId);
    }
  }

  _getSchemaInfo() {
    const stmt = this.db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1');
    const result = stmt.get();
    return {
      version: result?.version || 1,
      tables: this._getTableInfo()
    };
  }

  _getTableInfo() {
    const stmt = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    return stmt.all().map(row => row.name);
  }

  async _getTaskwerkVersion() {
    try {
      const pkg = JSON.parse(
        await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8')
      );
      return pkg.version;
    } catch {
      return 'unknown';
    }
  }

  async _getTaskService() {
    // Lazy load to avoid circular dependencies
    const { default: TaskService } = await import('./task-service.js');
    return new TaskService(this.db);
  }

  _getTaskServiceSync() {
    // This is a workaround for sync context
    // In real implementation, we'd use the existing service instance
    const stmt = this.db.prepare(`
      INSERT INTO tasks (string_id, name, description, status, priority, assignee, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    return {
      createTask: (data) => {
        // Simplified create
        const info = stmt.run(
          data.string_id || null,
          data.name,
          data.description || null,
          data.status || 'todo',
          data.priority || 'medium',
          data.assignee || null,
          JSON.stringify(data.tags || [])
        );
        return { id: info.lastInsertRowid };
      },
      updateTask: (id, data) => {
        // Simplified update
        const fields = [];
        const values = [];
        
        for (const [key, value] of Object.entries(data)) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
        
        values.push(id);
        
        this.db.prepare(
          `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`
        ).run(values);
      }
    };
  }
}