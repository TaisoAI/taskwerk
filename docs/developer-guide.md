# TaskWerk v2.0 Developer Guide

A technical guide to TaskWerk's architecture, implementation, and development processes.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Data Flow](#data-flow)
4. [File Format & Schema](#file-format--schema)
5. [Testing Strategy](#testing-strategy)
6. [Development Setup](#development-setup)
7. [Contributing Guidelines](#contributing-guidelines)
8. [API Reference](#api-reference)
9. [Extension Points](#extension-points)

## Architecture Overview

TaskWerk v2.0 follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Layer (src/cli.js)                 │
├─────────────────────────────────────────────────────────────┤
│           Commands Layer (src/commands/)                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │   add   │ │  start  │ │complete │ │  list   │ │  ...   │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────────┘ │
├─────────────────────────────────────────────────────────────┤
│              Core Domain Layer (src/core/)                 │
│  ┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ V2TaskManager   │ │ TaskSchema   │ │ YamlTaskParser   │  │
│  │                 │ │              │ │                  │  │
│  │ SessionManager  │ │ MigrationUtil│ │ TaskParser (v1)  │  │
│  └─────────────────┘ └──────────────┘ └──────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│            Integration Layer (src/git/, src/llm/)          │
│  ┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │   GitManager    │ │  LLMManager  │ │     Config       │  │
│  └─────────────────┘ └──────────────┘ └──────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                File System & External APIs                 │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Layered Architecture**: Clear separation between CLI, domain logic, and integrations
2. **YAML + Markdown**: Structured metadata with human-readable content
3. **Backward Compatibility**: Automatic migration from v1 formats
4. **Extensible**: Plugin-friendly architecture for new features
5. **Test-Driven**: Comprehensive test coverage (109+ tests)

## Core Components

### YamlTaskParser (`src/core/yaml-task-parser.js`)

Handles parsing and formatting of v2.0 YAML frontmatter tasks.

```javascript
export class YamlTaskParser {
  // Detect format and parse appropriately
  parseTasks(content) {
    if (this.hasYamlFrontmatter(content)) {
      return this.parseV2Tasks(content);
    } else {
      return this.parseV1Tasks(content); // Fallback to v1 parser
    }
  }

  // Format v2 task with YAML frontmatter
  formatV2Task(task) {
    return `---\n${yaml.dump(task.metadata)}\n---\n\n${task.markdownContent}`;
  }
}
```

**Key Responsibilities:**
- Detect v1 vs v2 format files
- Parse YAML frontmatter safely with error recovery
- Format tasks back to YAML + markdown
- Validate YAML syntax and provide meaningful errors

### V2TaskManager (`src/core/v2-task-manager.js`)

Enhanced task manager supporting all v2.0 features.

```javascript
export class V2TaskManager {
  constructor(config) {
    this.v1Parser = new TaskParser();      // Legacy support
    this.v2Parser = new YamlTaskParser();
    this.migrationUtil = new MigrationUtil();
    this.sessionManager = new SessionManager(config);
  }

  // Auto-migrates content when needed
  async addTask({ description, priority, category, assignee, dependencies }) {
    const content = await this._readTasksFile();
    const migratedContent = await this._ensureV2Format(content);
    // ... rest of implementation
  }
}
```

**Key Features:**
- Automatic format migration (v1 → v2)
- Dependencies with circular dependency detection  
- Subtask management
- Timeline tracking for all actions
- Enhanced filtering and search
- Session integration

### TaskSchema (`src/core/task-schema.js`)

Defines and validates the v2.0 task structure.

```javascript
export class TaskSchema {
  static getV2Schema() {
    return {
      id: { type: 'string', required: true, pattern: /^TASK-\d{3}$/ },
      description: { type: 'string', required: true },
      status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'blocked', 'archived'] },
      priority: { type: 'string', enum: ['high', 'medium', 'low'], default: 'medium' },
      category: { type: 'string', optional: true },
      assignee: { type: 'string', pattern: /^@\w+$/, optional: true },
      estimated: { type: 'string', pattern: /^\d+[hmdw]$/, optional: true },
      dependencies: { type: 'array', items: { type: 'string' }, default: [] },
      subtasks: { type: 'array', default: [] },
      timeline: { type: 'array', default: [] }
    };
  }

  static validateV2Task(task) {
    // Comprehensive validation logic
    const errors = [];
    // ... validation implementation
    return { valid: errors.length === 0, errors };
  }
}
```

**Validation Features:**
- Schema definition and enforcement
- Default value assignment
- Format validation (assignee @username, estimates, etc.)
- Comprehensive error reporting

### MigrationUtil (`src/core/migration-util.js`)

Handles migration from v1 to v2.0 format.

```javascript
export class MigrationUtil {
  migrateContent(content) {
    if (!this.needsMigration(content)) {
      return { content, migrated: false };
    }
    
    const v1Tasks = this.v1Parser.parseTasks(content);
    const v2TaskBlocks = v1Tasks.map(task => this.convertTaskToV2(task));
    
    return { 
      content: this.buildV2Content(v2TaskBlocks), 
      migrated: true 
    };
  }
}
```

**Migration Process:**
1. Detect if migration is needed
2. Parse existing v1 tasks
3. Convert to v2 schema with validation
4. Generate new YAML frontmatter format
5. Preserve all existing data

## Data Flow

### Task Creation Flow

```
User Command
    ↓
CLI Parser (Commander.js)
    ↓
Command Handler (src/commands/add.js)
    ↓
V2TaskManager.addTask()
    ↓
┌─────────────────┐
│ Read tasks.md   │
│ Check format    │
│ Auto-migrate    │
└─────────────────┘
    ↓
┌─────────────────┐
│ Generate ID     │
│ Validate schema │
│ Create timeline │
└─────────────────┘
    ↓
┌─────────────────┐
│ Format YAML     │
│ Write to file   │
│ Update session  │
└─────────────────┘
```

### Dependency Resolution Flow

```
Start Task Command
    ↓
V2TaskManager.startTask()
    ↓
┌─────────────────────┐
│ Check dependencies  │
│ Validate completion │
│ Detect cycles       │
└─────────────────────┘
    ↓
┌─────────────────────┐
│ Update task status  │
│ Add timeline entry  │
│ Update session      │
└─────────────────────┘
```

## File Format & Schema

### YAML Frontmatter Structure

```yaml
---
# Required fields
id: TASK-001
description: "Task description"
status: todo
format: v2

# Optional metadata
priority: medium
category: features
assignee: "@username"
estimated: "2h"
created: 2025-06-30T10:00:00.000Z
updated: 2025-06-30T10:00:00.000Z

# Relationships
dependencies: ["TASK-002", "TASK-003"]
subtasks:
  - id: TASK-001.1
    description: "Subtask description"
    status: todo
    assignee: "@username"

# History tracking
timeline:
  - timestamp: 2025-06-30T10:00:00.000Z
    action: created
    user: "@username"
  - timestamp: 2025-06-30T10:15:00.000Z
    action: started
    user: "@username"
    note: "Beginning work"
---
```

### File Organization

```
tasks/
├── tasks.md              # Active tasks (v2.0 YAML format)
├── tasks_completed.md    # Completed/archived tasks
├── .task-session.json    # Current session state
├── tasks-how-to.md       # Quick reference
└── taskwerk-rules.md     # Project workflow rules

.taskrc.json              # Project configuration
```

### Internal Data Structures

```javascript
// Task object structure
const task = {
  // Metadata (stored in YAML frontmatter)
  id: 'TASK-001',
  description: 'Task description',
  status: 'in_progress',
  priority: 'high',
  category: 'bugs',
  assignee: '@john',
  estimated: '2h',
  created: new Date(),
  updated: new Date(),
  dependencies: ['TASK-002'],
  subtasks: [/* subtask objects */],
  timeline: [/* timeline entries */],
  format: 'v2',
  
  // Content (stored as markdown body)
  markdownContent: '# Task Title\n\nDetailed description...'
};
```

## Testing Strategy

TaskWerk has comprehensive test coverage with 109+ tests across multiple categories:

### Test Structure

```
tests/
├── commands/           # CLI command tests
│   ├── add.test.js
│   ├── complete.test.js
│   └── ...
├── core/              # Core logic tests
│   ├── v2-task-manager.test.js
│   ├── yaml-task-parser.test.js
│   ├── task-schema.test.js
│   ├── migration-util.test.js
│   └── ...
├── git/               # Git integration tests
├── utils/             # Utility function tests
└── dist/              # Distribution build tests
```

### Test Categories

1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Component interaction testing  
3. **End-to-End Tests**: Full CLI workflow testing
4. **Migration Tests**: v1 → v2 conversion testing
5. **Error Handling Tests**: Edge cases and error conditions

### Running Tests

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
node --test tests/core/     # Specific test directory
DEBUG=taskwerk* npm test    # Debug mode
```

### Test Patterns

```javascript
describe('V2TaskManager', () => {
  let taskManager;
  let testDir;
  
  beforeEach(async () => {
    // Create isolated test environment
    testDir = path.join('/tmp', `taskwerk-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    
    taskManager = new V2TaskManager({
      tasksFile: path.join(testDir, 'tasks.md'),
      completedFile: path.join(testDir, 'tasks_completed.md')
    });
    
    // Initialize with v2 format
    await writeFile(config.tasksFile, '<!-- TaskWerk v2.0 Format -->\n\n', 'utf8');
  });
  
  afterEach(async () => {
    // Clean up test environment
    await rm(testDir, { recursive: true });
  });
});
```

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- Git for version control
- Preferred editor with ESLint support

### Local Development

```bash
# Clone repository
git clone https://github.com/deftio/taskwerk.git
cd taskwerk

# Install dependencies
npm install

# Run tests
npm test

# Lint code
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check

# Build distribution
npm run build
npm run build:minified

# Run local development version
npm run dev add "Test task"
```

### Code Style

TaskWerk uses:
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **ES Modules**: Modern JavaScript imports/exports
- **JSDoc**: Documentation comments for complex functions

### Git Workflow

```bash
# Feature development
git checkout -b feature/new-functionality
# ... implement changes ...
npm test                    # Ensure tests pass
npm run lint               # Check code style
git add .
git commit -m "feat: Add new functionality"
git push origin feature/new-functionality
# ... create pull request ...
```

## Contributing Guidelines

### Adding New Commands

1. **Create command file**: `src/commands/your-command.js`
2. **Implement command logic**: Follow existing patterns
3. **Add to CLI**: Register in `src/cli.js`
4. **Write tests**: Create `tests/commands/your-command.test.js`
5. **Update documentation**: Add to README and user guide

```javascript
// Example command structure
export async function yourCommand(arg1, options) {
  try {
    const config = await loadConfig();
    const taskManager = new V2TaskManager(config);
    
    // ... implement command logic ...
    
    console.log('Command completed successfully');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
```

### Extending Core Features

#### Adding Task Metadata Fields

1. **Update TaskSchema**: Add field definition with validation
2. **Modify parsers**: Update YAML parsing logic
3. **Update commands**: Add command-line options
4. **Write tests**: Ensure validation and parsing work
5. **Document**: Update user guide and README

#### Adding New Task Relationships

1. **Extend V2TaskManager**: Add relationship management methods
2. **Update validation**: Ensure data integrity
3. **Add commands**: Create CLI interface
4. **Test thoroughly**: Including edge cases and circular references

### Code Review Checklist

- [ ] Tests pass (`npm test`)
- [ ] Code is linted (`npm run lint`)
- [ ] Code is formatted (`npm run format:check`)
- [ ] New functionality has tests
- [ ] Documentation is updated
- [ ] Backward compatibility is maintained
- [ ] Error handling is comprehensive

## API Reference

### V2TaskManager

```javascript
const taskManager = new V2TaskManager(config);

// Task management
await taskManager.addTask(taskData);
await taskManager.getTasks(filters);
await taskManager.getTask(taskId);
await taskManager.startTask(taskId, options);
await taskManager.completeTask(taskId, options);
await taskManager.pauseTask(taskId, options);
await taskManager.blockTask(taskId, options);
await taskManager.unblockTask(taskId, options);
await taskManager.archiveTask(taskId, options);

// Dependencies
await taskManager.addDependency(taskId, dependencyId);
await taskManager.removeDependency(taskId, dependencyId);
await taskManager.getReadyTasks();
await taskManager.getDependencyTree(taskId);

// Subtasks
await taskManager.addSubtask(parentId, subtaskData);
await taskManager.updateSubtask(parentId, subtaskId, updates);

// Information
await taskManager.searchTasks(query);
await taskManager.getStats();
await taskManager.getRecentlyCompleted(limit);
await taskManager.getTaskContext(taskId);
```

### YamlTaskParser

```javascript
const parser = new YamlTaskParser();

// Parsing
parser.hasYamlFrontmatter(content);
parser.parseTasks(content);
parser.parseV2Tasks(content);

// Formatting
parser.formatV2Task(task);
parser.extractYamlAndMarkdown(content);
```

### TaskSchema

```javascript
// Validation
TaskSchema.validateV2Task(task);
TaskSchema.createV2Task(data);
TaskSchema.getV2Schema();
```

## Extension Points

### Custom Task Fields

```javascript
// Extend schema
const customSchema = {
  ...TaskSchema.getV2Schema(),
  customField: { type: 'string', optional: true }
};

// Custom validation
class CustomTaskSchema extends TaskSchema {
  static validateV2Task(task) {
    // Custom validation logic
  }
}
```

### Custom Commands

```javascript
// Plugin-style command
export function customCommand(args, options) {
  // Custom command implementation
}

// Register in CLI
program
  .command('custom')
  .description('Custom command description')
  .action(customCommand);
```

### Custom Integrations

```javascript
// Custom integration
class CustomIntegration {
  async syncTasks(tasks) {
    // Sync with external system
  }
}

// Use in task manager
const integration = new CustomIntegration();
await integration.syncTasks(await taskManager.getTasks());
```

### Event Hooks

```javascript
// Task lifecycle hooks
class TaskHooks {
  async onTaskCreated(task) { /* custom logic */ }
  async onTaskStarted(task) { /* custom logic */ }
  async onTaskCompleted(task) { /* custom logic */ }
}
```

---

*For user-facing documentation, see the [User Guide](user-guide.md) and [README.md](../README.md)*