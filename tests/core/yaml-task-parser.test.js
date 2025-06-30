import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { YamlTaskParser } from '../../src/core/yaml-task-parser.js';
import { TaskParser } from '../../src/core/task-parser.js';

describe('YamlTaskParser', () => {
  let parser;
  let v1Parser;

  beforeEach(() => {
    parser = new YamlTaskParser();
    v1Parser = new TaskParser();
    parser.setV1Parser(v1Parser);
  });

  describe('format detection', () => {
    it('should detect v2 format with YAML frontmatter', () => {
      const content = `---
id: TASK-001
state: todo
priority: high
---

# Fix authentication bug

This is a description.`;

      assert.strictEqual(parser.hasYamlFrontmatter(content), true);
    });

    it('should detect v1 format without YAML frontmatter', () => {
      const content = `# Tasks

- [ ] **TASK-001** Fix authentication bug`;

      assert.strictEqual(parser.hasYamlFrontmatter(content), false);
    });
  });

  describe('v2 format parsing', () => {
    it('should parse basic v2 task with YAML frontmatter', () => {
      const content = `---
id: TASK-001
created: 2025-06-29T14:30:00Z
state: todo
priority: high
category: bugs
---

# Fix authentication bug

Users are being logged out after 30 minutes of inactivity.`;

      const tasks = parser.parseTasks(content);

      assert.strictEqual(tasks.length, 1);

      const task = tasks[0];
      assert.strictEqual(task.id, 'TASK-001');
      assert.strictEqual(task.description, 'Fix authentication bug');
      assert.strictEqual(task.status, 'todo');
      assert.strictEqual(task.priority, 'high');
      assert.strictEqual(task.category, 'bugs');
      assert.strictEqual(task.format, 'v2');
    });

    it('should parse task with full v2 schema', () => {
      const content = `---
id: TASK-045
created: 2025-06-29T14:30:00Z
priority: high
category: bugs
assignee: "@johndoe"
dependencies: 
  - TASK-043
  - TASK-044
estimated: 4h
state: in-progress
timeline:
  - started: 2025-06-29T15:00:00Z
  - paused: 2025-06-29T16:30:00Z
  - resumed: 2025-06-30T09:00:00Z
git:
  commits:
    - "abc123f: Fix session timeout calculation"
    - "def456a: Add comprehensive tests"
files:
  - src/auth/session-manager.js
  - tests/auth/session-timeout.test.js
subtasks:
  - id: TASK-045.1
    description: Update timeout logic
    state: completed
  - id: TASK-045.2
    description: Add error handling
    state: in-progress
---

# Fix user authentication timeout issue

**Description:**
Users are being logged out after 30 minutes of inactivity instead of the configured 2 hours.

**Acceptance Criteria:**
- Session timeout should respect the 2-hour configuration
- Token refresh should properly extend session duration
- Add tests to verify timeout behavior`;

      const tasks = parser.parseTasks(content);

      assert.strictEqual(tasks.length, 1);

      const task = tasks[0];
      assert.strictEqual(task.id, 'TASK-045');
      assert.strictEqual(task.description, 'Fix user authentication timeout issue');
      assert.strictEqual(task.status, 'in_progress');
      assert.strictEqual(task.assignee, '@johndoe');
      assert.deepStrictEqual(task.dependencies, ['TASK-043', 'TASK-044']);
      assert.strictEqual(task.estimated, '4h');
      assert.strictEqual(task.timeline.length, 3);
      assert.strictEqual(task.git.commits.length, 2);
      assert.strictEqual(task.files.length, 2);
      assert.strictEqual(task.subtasks.length, 2);
    });

    it('should parse completed task with completion data', () => {
      const content = `---
id: TASK-001
state: completed
completedAt: 2025-06-29T16:00:00Z
note: Fixed session timeout logic
filesChanged: 
  - src/auth.js
  - tests/auth.test.js
---

# Fix login bug

Fixed the authentication timeout issue.`;

      const tasks = parser.parseTasks(content);
      const task = tasks[0];

      assert.strictEqual(task.status, 'completed');
      assert.strictEqual(task.note, 'Fixed session timeout logic');
      assert.strictEqual(task.filesChanged.length, 2);
    });

    it('should parse archived task with archive data', () => {
      const content = `---
id: TASK-001
state: archived
archivedAt: 2025-06-29T16:00:00Z
archiveReason: Requirements changed
supersededBy: TASK-050
note: May revisit in Q3
---

# Old feature request

This feature is no longer needed.`;

      const tasks = parser.parseTasks(content);
      const task = tasks[0];

      assert.strictEqual(task.status, 'archived');
      assert.strictEqual(task.archiveReason, 'Requirements changed');
      assert.strictEqual(task.supersededBy, 'TASK-050');
      assert.strictEqual(task.note, 'May revisit in Q3');
    });
  });

  describe('v1 format backward compatibility', () => {
    it('should parse v1 format using legacy parser', () => {
      const content = `# Tasks

## HIGH Priority

- [ ] **TASK-001** Fix authentication bug
- [>] **TASK-002** Add dark mode

## MEDIUM Priority

- [x] **TASK-003** Update documentation *[2025-06-29T14:00:00Z]*`;

      const tasks = parser.parseTasks(content);

      assert.strictEqual(tasks.length, 3);
      assert.strictEqual(tasks[0].id, 'TASK-001');
      assert.strictEqual(tasks[0].status, 'todo');
      assert.strictEqual(tasks[1].id, 'TASK-002');
      assert.strictEqual(tasks[1].status, 'in_progress');
      assert.strictEqual(tasks[2].id, 'TASK-003');
      assert.strictEqual(tasks[2].status, 'completed');
    });
  });

  describe('multiple task blocks', () => {
    it('should parse multiple v2 task blocks', () => {
      const content = `---
id: TASK-001
state: todo
priority: high
---

# First task

This is the first task.

---
id: TASK-002
state: in-progress
priority: medium
---

# Second task

This is the second task.`;

      const tasks = parser.parseTasks(content);

      assert.strictEqual(tasks.length, 2);
      assert.strictEqual(tasks[0].id, 'TASK-001');
      assert.strictEqual(tasks[0].status, 'todo');
      assert.strictEqual(tasks[1].id, 'TASK-002');
      assert.strictEqual(tasks[1].status, 'in_progress');
    });
  });

  describe('error recovery', () => {
    it('should skip malformed task blocks and continue parsing', () => {
      const content = `---
id: TASK-001
state: todo
---

# Good task

This task is valid.

---
invalid yaml: [unclosed bracket
state: todo
---

# Bad task

This task has invalid YAML.

---
id: TASK-003
state: completed
---

# Another good task

This task is also valid.`;

      const tasks = parser.parseTasks(content);

      // Should get 2 tasks (skipping the malformed one)
      assert.strictEqual(tasks.length, 2);
      assert.strictEqual(tasks[0].id, 'TASK-001');
      assert.strictEqual(tasks[1].id, 'TASK-003');
    });

    it('should handle missing required fields gracefully', () => {
      const content = `---
state: todo
priority: high
---

# Task without ID

This task is missing an ID.`;

      const tasks = parser.parseTasks(content);

      // Should skip the task with missing ID
      assert.strictEqual(tasks.length, 0);
    });
  });

  describe('status normalization', () => {
    it('should normalize various status formats', () => {
      const testCases = [
        { input: 'todo', expected: 'todo' },
        { input: 'in_progress', expected: 'in_progress' },
        { input: 'in-progress', expected: 'in_progress' },
        { input: 'progress', expected: 'in_progress' },
        { input: 'completed', expected: 'completed' },
        { input: 'complete', expected: 'completed' },
        { input: 'done', expected: 'completed' },
        { input: 'blocked', expected: 'blocked' },
        { input: 'block', expected: 'blocked' },
        { input: 'archived', expected: 'archived' },
        { input: 'archive', expected: 'archived' },
        { input: 'unknown', expected: 'todo' },
      ];

      testCases.forEach(({ input, expected }) => {
        const normalized = parser.normalizeStatus(input);
        assert.strictEqual(normalized, expected, `Expected ${input} to normalize to ${expected}`);
      });
    });
  });

  describe('task formatting', () => {
    it('should format v2 task back to YAML frontmatter + markdown', () => {
      const task = {
        id: 'TASK-001',
        description: 'Fix authentication bug',
        status: 'todo',
        priority: 'high',
        category: 'bugs',
        created: new Date('2025-06-29T14:30:00Z'),
        assignee: '@johndoe',
        dependencies: ['TASK-043'],
        estimated: '2h',
        files: ['src/auth.js'],
        markdownContent: '# Fix authentication bug\n\nThis is a test task.',
      };

      const formatted = parser.formatV2Task(task);

      assert(formatted.includes('---'));
      assert(formatted.includes('id: TASK-001'));
      assert(formatted.includes('state: todo'));
      assert(formatted.includes('priority: high'));
      assert(formatted.includes('# Fix authentication bug'));
    });

    it('should build frontmatter with only relevant fields', () => {
      const task = {
        id: 'TASK-001',
        description: 'Simple task',
        status: 'todo',
        priority: 'medium',
        created: new Date('2025-06-29T14:30:00Z'),
      };

      const frontmatter = parser.buildFrontmatter(task);

      assert(frontmatter.includes('id: TASK-001'));
      assert(frontmatter.includes('state: todo'));
      assert(frontmatter.includes('priority: medium'));
      assert(!frontmatter.includes('assignee'));
      assert(!frontmatter.includes('dependencies'));
    });
  });

  describe('task validation', () => {
    it('should validate v2 task schema', () => {
      const validTask = {
        id: 'TASK-001',
        description: 'Valid task',
        status: 'todo',
        priority: 'high',
        dependencies: ['TASK-000'],
        subtasks: [],
      };

      const errors = parser.validateV2Task(validTask);
      assert.strictEqual(errors.length, 0);
    });

    it('should detect validation errors', () => {
      const invalidTask = {
        // Missing id
        description: 'Invalid task',
        status: 'invalid_status',
        priority: 'invalid_priority',
        dependencies: 'not_an_array',
        subtasks: 'not_an_array',
      };

      const errors = parser.validateV2Task(invalidTask);
      assert(errors.length > 0);
      assert(errors.some(e => e.includes('Task ID is required')));
      assert(errors.some(e => e.includes('Invalid status')));
      assert(errors.some(e => e.includes('Invalid priority')));
      assert(errors.some(e => e.includes('Dependencies must be an array')));
      assert(errors.some(e => e.includes('Subtasks must be an array')));
    });
  });

  describe('description extraction', () => {
    it('should extract description from markdown header', () => {
      const content = '# Fix authentication bug\n\nThis is the description.';
      const metadata = {};

      const description = parser.extractDescription(content, metadata);
      assert.strictEqual(description, 'Fix authentication bug');
    });

    it('should extract description from task line', () => {
      const content = '- [ ] **TASK-001** Fix authentication bug\n\nMore details.';
      const metadata = {};

      const description = parser.extractDescription(content, metadata);
      assert.strictEqual(description, 'Fix authentication bug');
    });

    it('should fallback to frontmatter description', () => {
      const content = 'Some content without clear description.';
      const metadata = { description: 'Fallback description' };

      const description = parser.extractDescription(content, metadata);
      assert.strictEqual(description, 'Fallback description');
    });

    it('should provide default description when nothing found', () => {
      const content = 'Some content without clear description.';
      const metadata = {};

      const description = parser.extractDescription(content, metadata);
      assert.strictEqual(description, 'No description provided');
    });
  });
});
