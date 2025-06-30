import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MigrationUtil } from '../../src/core/migration-util.js';

describe('MigrationUtil', () => {
  let migrationUtil;

  beforeEach(() => {
    migrationUtil = new MigrationUtil();
  });

  describe('migration detection', () => {
    it('should detect v1 content that needs migration', () => {
      const v1Content = `# Tasks

## HIGH Priority

- [ ] **TASK-001** Fix authentication bug
- [>] **TASK-002** Add dark mode`;

      assert.strictEqual(migrationUtil.needsMigration(v1Content), true);
    });

    it('should detect v2 content that does not need migration', () => {
      const v2Content = `---
id: TASK-001
state: todo
---

# Fix authentication bug`;

      assert.strictEqual(migrationUtil.needsMigration(v2Content), false);
    });

    it('should handle empty content', () => {
      assert.strictEqual(migrationUtil.needsMigration(''), false);
      assert.strictEqual(migrationUtil.needsMigration('   '), false);
    });
  });

  describe('full content migration', () => {
    it('should migrate v1 content to v2 format', () => {
      const v1Content = `# Tasks

## HIGH Priority

- [ ] **TASK-001** Fix authentication bug
- [>] **TASK-002** Add dark mode

## MEDIUM Priority  

- [x] **TASK-003** Update documentation *[2025-06-29T14:00:00Z]*`;

      const result = migrationUtil.migrateContent(v1Content);

      assert.strictEqual(result.migrated, true);
      assert.strictEqual(result.tasksConverted, 3);
      assert.strictEqual(result.originalFormat, 'v1');
      assert.strictEqual(result.newFormat, 'v2');

      // Should contain YAML frontmatter
      assert(result.content.includes('---'));
      assert(result.content.includes('id: TASK-001'));
      assert(result.content.includes('state: todo'));
      assert(result.content.includes('# Fix authentication bug'));

      // Should contain migration header
      assert(result.content.includes('TaskWerk v2.0 Format'));
      assert(result.content.includes('Migrated from v1 format'));
    });

    it('should handle v2 content without migration', () => {
      const v2Content = `---
id: TASK-001
state: todo
---

# Already migrated task`;

      const result = migrationUtil.migrateContent(v2Content);

      assert.strictEqual(result.migrated, false);
      assert.strictEqual(result.tasksConverted, 0);
      assert.strictEqual(result.content, v2Content);
    });

    it('should handle empty content gracefully', () => {
      const result = migrationUtil.migrateContent('');

      assert.strictEqual(result.migrated, false);
      assert.strictEqual(result.tasksConverted, 0);
    });

    it('should handle content with no tasks', () => {
      const contentWithNoTasks = `# My Tasks

This is just a header with no actual tasks.`;

      const result = migrationUtil.migrateContent(contentWithNoTasks);

      assert.strictEqual(result.migrated, false);
      assert.strictEqual(result.tasksConverted, 0);
      assert(result.warning?.includes('No tasks found'));
    });
  });

  describe('single task migration', () => {
    it('should convert v1 task to v2 format', () => {
      const v1Task = {
        id: 'TASK-001',
        description: 'Fix authentication bug',
        status: 'todo',
        priority: 'high',
        category: 'bugs',
      };

      const v2Task = migrationUtil.migrateTask(v1Task);

      assert.strictEqual(v2Task.id, 'TASK-001');
      assert.strictEqual(v2Task.description, 'Fix authentication bug');
      assert.strictEqual(v2Task.status, 'todo');
      assert.strictEqual(v2Task.priority, 'high');
      assert.strictEqual(v2Task.category, 'bugs');
      assert.strictEqual(v2Task.format, 'v2');

      // Should have v2 enhanced fields
      assert(Array.isArray(v2Task.dependencies));
      assert(Array.isArray(v2Task.timeline));
      assert(Array.isArray(v2Task.subtasks));
      assert(typeof v2Task.git === 'object');
      assert(typeof v2Task.markdownContent === 'string');
    });

    it('should preserve completed task data during migration', () => {
      const v1CompletedTask = {
        id: 'TASK-001',
        description: 'Fix bug',
        status: 'completed',
        completedAt: '2025-06-29T14:00:00Z',
        note: 'Fixed the issue',
        filesChanged: ['src/auth.js', 'tests/auth.test.js'],
      };

      const v2Task = migrationUtil.migrateTask(v1CompletedTask);

      assert.strictEqual(v2Task.status, 'completed');
      assert.strictEqual(v2Task.note, 'Fixed the issue');
      assert.deepStrictEqual(v2Task.filesChanged, ['src/auth.js', 'tests/auth.test.js']);
      assert.deepStrictEqual(v2Task.files, ['src/auth.js', 'tests/auth.test.js']);
      assert.strictEqual(v2Task.timeline.length, 1);
      assert(v2Task.timeline[0].completed);
    });

    it('should preserve archived task data during migration', () => {
      const v1ArchivedTask = {
        id: 'TASK-001',
        description: 'Old feature',
        status: 'archived',
        archivedAt: '2025-06-29T14:00:00Z',
        archiveReason: 'Requirements changed',
        supersededBy: 'TASK-050',
        note: 'May revisit later',
      };

      const v2Task = migrationUtil.migrateTask(v1ArchivedTask);

      assert.strictEqual(v2Task.status, 'archived');
      assert.strictEqual(v2Task.archiveReason, 'Requirements changed');
      assert.strictEqual(v2Task.supersededBy, 'TASK-050');
      assert.strictEqual(v2Task.note, 'May revisit later');
      assert.strictEqual(v2Task.timeline.length, 1);
      assert(v2Task.timeline[0].archived);
    });

    it('should not migrate task that is already v2', () => {
      const v2Task = {
        id: 'TASK-001',
        description: 'Already migrated',
        format: 'v2',
      };

      const result = migrationUtil.migrateTask(v2Task);

      assert.strictEqual(result, v2Task); // Should return same object
    });
  });

  describe('markdown content generation', () => {
    it('should generate proper markdown content for basic task', () => {
      const task = {
        id: 'TASK-001',
        description: 'Fix authentication bug',
        category: 'bugs',
        status: 'todo',
      };

      const markdown = migrationUtil.generateMarkdownContent(task);

      assert(markdown.includes('# Fix authentication bug'));
      assert(markdown.includes('**Description:**'));
      assert(markdown.includes('**Category:** bugs'));
      assert(markdown.includes('**Acceptance Criteria:**'));
      assert(markdown.includes('Migrated from TaskWerk v1 format'));
    });

    it('should include completion details in markdown', () => {
      const completedTask = {
        id: 'TASK-001',
        description: 'Fix bug',
        status: 'completed',
        note: 'Fixed successfully',
        filesChanged: ['src/auth.js'],
      };

      const markdown = migrationUtil.generateMarkdownContent(completedTask);

      assert(markdown.includes('Fixed successfully'));
      assert(markdown.includes('**Files Modified:**'));
      assert(markdown.includes('- src/auth.js'));
    });

    it('should include archive reason in markdown', () => {
      const archivedTask = {
        id: 'TASK-001',
        description: 'Old feature',
        status: 'archived',
        archiveReason: 'No longer needed',
      };

      const markdown = migrationUtil.generateMarkdownContent(archivedTask);

      assert(markdown.includes('Archive reason: No longer needed'));
    });
  });

  describe('migration planning', () => {
    it('should create migration plan for v1 content', () => {
      const v1Content = `# Tasks

- [ ] **TASK-001** Fix bug
- [>] **TASK-002** Add feature`;

      const plan = migrationUtil.createMigrationPlan(v1Content);

      assert.strictEqual(plan.needsMigration, true);
      assert.strictEqual(plan.tasksToMigrate, 2);
      assert.strictEqual(plan.tasks.length, 2);
      assert.strictEqual(plan.tasks[0].id, 'TASK-001');
      assert.strictEqual(plan.backupRecommended, true);
      assert(typeof plan.estimatedSize === 'object');
    });

    it('should indicate no migration needed for v2 content', () => {
      const v2Content = `---
id: TASK-001
state: todo
---

# Already migrated`;

      const plan = migrationUtil.createMigrationPlan(v2Content);

      assert.strictEqual(plan.needsMigration, false);
      assert(plan.reason.includes('already in v2 format'));
    });

    it('should handle malformed content gracefully', () => {
      const malformedContent = 'This is not valid task content';

      const plan = migrationUtil.createMigrationPlan(malformedContent);

      assert.strictEqual(plan.needsMigration, false);
      assert(plan.reason?.includes('No tasks found to migrate'));
    });
  });

  describe('migration validation', () => {
    it('should validate successful migration', () => {
      const v1Content = `# Tasks

- [ ] **TASK-001** Fix bug
- [>] **TASK-002** Add feature`;

      const migrationResult = migrationUtil.migrateContent(v1Content);
      const validation = migrationUtil.validateMigration(v1Content, migrationResult.content);

      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.errors.length, 0);
      assert.strictEqual(validation.v1TaskCount, 2);
      assert.strictEqual(validation.v2TaskCount, 2);
    });

    it('should detect validation errors', () => {
      const v1Content = `# Tasks

- [ ] **TASK-001** Fix bug`;

      // Simulate corrupted migration result
      const corruptedV2Content = `---
id: TASK-999
state: todo
---

# Wrong task`;

      const validation = migrationUtil.validateMigration(v1Content, corruptedV2Content);

      assert.strictEqual(validation.valid, false);
      assert(validation.errors.length > 0);
      assert(validation.errors.some(e => e.includes('TASK-001 not found')));
    });
  });

  describe('size estimation', () => {
    it('should estimate v2 content size', () => {
      const tasks = [
        { id: 'TASK-001', description: 'Task 1' },
        { id: 'TASK-002', description: 'Task 2' },
      ];

      const estimate = migrationUtil.estimateV2Size(tasks);

      assert(typeof estimate.estimatedBytes === 'number');
      assert(typeof estimate.estimatedLines === 'number');
      assert(estimate.estimatedBytes > 1000); // Should be reasonable size
      assert(estimate.multiplier.includes('3-4x'));
    });
  });

  describe('header extraction', () => {
    it('should extract v1 header information', () => {
      const v1Content = `# My Project Tasks
*Project: TaskWerk*
*Version: 1.0*

## HIGH Priority

- [ ] **TASK-001** Fix bug`;

      const header = migrationUtil.extractV1Header(v1Content);

      assert(header.includes('My Project Tasks'));
      assert(header.includes('Project: TaskWerk'));
      assert(header.includes('Version: 1.0'));
    });

    it('should handle content without headers', () => {
      const contentWithoutHeaders = `- [ ] **TASK-001** Just a task`;

      const header = migrationUtil.extractV1Header(contentWithoutHeaders);

      assert.strictEqual(header, '');
    });
  });
});
