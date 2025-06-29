import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { TaskRules } from '../../src/core/task-rules.js';

describe('TaskRules', () => {
  let taskRules;
  let testConfig;
  let tempDir;
  let originalEnv;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create temp directory for test files
    tempDir = await fs.mkdtemp('/tmp/taskwerk-test-');

    // Change to temp directory so TaskRules constructor works
    process.chdir(tempDir);

    // Create tasks directory
    await fs.mkdir('tasks', { recursive: true });

    testConfig = {
      tasksFile: join(tempDir, 'tasks.md'),
      completedFile: join(tempDir, 'tasks_completed.md'),
    };

    taskRules = new TaskRules(testConfig);

    // Override rules file path for testing
    taskRules.rulesFile = join(tempDir, 'taskwerk-rules.md');
  });

  afterEach(async () => {
    // Restore environment and working directory
    process.env = originalEnv;
    process.chdir('/Users/manu/taiso/taskwerk');

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('detectWorkflowMode()', () => {
    it('should detect AI mode when CLAUDE_CODE is set', async () => {
      process.env.CLAUDE_CODE = '1';
      const mode = await taskRules.detectWorkflowMode();
      assert.strictEqual(mode, 'ai');
    });

    it('should detect AI mode when CURSOR is set', async () => {
      process.env.CURSOR = '1';
      const mode = await taskRules.detectWorkflowMode();
      assert.strictEqual(mode, 'ai');
    });

    it('should detect AI mode when COPILOT is set', async () => {
      process.env.COPILOT = '1';
      const mode = await taskRules.detectWorkflowMode();
      assert.strictEqual(mode, 'ai');
    });

    it('should detect human mode by default', async () => {
      delete process.env.CLAUDE_CODE;
      delete process.env.CURSOR;
      delete process.env.COPILOT;
      const mode = await taskRules.detectWorkflowMode();
      assert.strictEqual(mode, 'human');
    });
  });

  describe('loadRules()', () => {
    it('should create default rules when file does not exist', async () => {
      const rules = await taskRules.loadRules();

      assert.strictEqual(typeof rules, 'object');
      assert.strictEqual(typeof rules.ai, 'object');
      assert.strictEqual(typeof rules.human, 'object');
      assert.strictEqual(typeof rules.global, 'object');

      // Check AI mode defaults
      assert.strictEqual(rules.ai.enforceWorkflow, true);
      assert.strictEqual(Array.isArray(rules.ai.requiredPhases), true);
      assert.strictEqual(rules.ai.qualityGates.testsRequired, true);

      // Check human mode defaults
      assert.strictEqual(rules.human.enforceWorkflow, false);
      assert.strictEqual(rules.human.qualityGates.testsRequired, false);
    });

    it('should create rules file when it does not exist', async () => {
      await taskRules.loadRules();

      const fileExists = await fs
        .access(taskRules.rulesFile)
        .then(() => true)
        .catch(() => false);

      assert.strictEqual(fileExists, true);
    });

    it('should cache rules after first load', async () => {
      const rules1 = await taskRules.loadRules();
      const rules2 = await taskRules.loadRules();

      assert.strictEqual(rules1, rules2); // Same object reference
    });
  });

  describe('validateTask()', () => {
    it('should pass validation when enforcement is disabled (human mode)', async () => {
      delete process.env.CLAUDE_CODE;

      const validation = await taskRules.validateTask('TASK-001', 'implement');

      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.errors.length, 0);
      assert.strictEqual(validation.warnings.length, 0);
    });

    it('should validate required phases in AI mode', async () => {
      process.env.CLAUDE_CODE = '1';

      const validation = await taskRules.validateTask('TASK-001', 'implement');

      assert.strictEqual(typeof validation, 'object');
      assert.strictEqual(typeof validation.valid, 'boolean');
      assert.strictEqual(Array.isArray(validation.errors), true);
      assert.strictEqual(Array.isArray(validation.warnings), true);
      assert.strictEqual(Array.isArray(validation.requiredActions), true);
    });

    it('should return validation for test phase', async () => {
      process.env.CLAUDE_CODE = '1';

      const validation = await taskRules.validateTask('TASK-001', 'test');

      assert.strictEqual(typeof validation, 'object');
      assert.strictEqual(typeof validation.valid, 'boolean');
    });

    it('should return validation for document phase', async () => {
      process.env.CLAUDE_CODE = '1';

      const validation = await taskRules.validateTask('TASK-001', 'document');

      assert.strictEqual(typeof validation, 'object');
      assert.strictEqual(typeof validation.valid, 'boolean');
    });
  });

  describe('bumpVersion()', () => {
    let packagePath;

    beforeEach(async () => {
      packagePath = join(tempDir, 'package.json');

      // Create test package.json
      await fs.writeFile(
        packagePath,
        JSON.stringify(
          {
            name: 'test-package',
            version: '1.2.3',
          },
          null,
          2
        )
      );

      // Change working directory to temp dir
      process.chdir(tempDir);
    });

    it('should bump patch version correctly', async () => {
      const newVersion = await taskRules.bumpVersion('patch');
      assert.strictEqual(newVersion, '1.2.4');

      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageData = JSON.parse(packageContent);
      assert.strictEqual(packageData.version, '1.2.4');
    });

    it('should bump minor version correctly', async () => {
      const newVersion = await taskRules.bumpVersion('minor');
      assert.strictEqual(newVersion, '1.3.0');

      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageData = JSON.parse(packageContent);
      assert.strictEqual(packageData.version, '1.3.0');
    });

    it('should bump major version correctly', async () => {
      const newVersion = await taskRules.bumpVersion('major');
      assert.strictEqual(newVersion, '2.0.0');

      const packageContent = await fs.readFile(packagePath, 'utf8');
      const packageData = JSON.parse(packageContent);
      assert.strictEqual(packageData.version, '2.0.0');
    });

    it('should return null for invalid version type', async () => {
      const newVersion = await taskRules.bumpVersion('invalid');
      assert.strictEqual(newVersion, null);
    });

    it('should handle missing package.json gracefully', async () => {
      await fs.unlink(packagePath);
      const newVersion = await taskRules.bumpVersion('patch');
      assert.strictEqual(newVersion, null);
    });

    it('should handle package.json without version field', async () => {
      await fs.writeFile(
        packagePath,
        JSON.stringify(
          {
            name: 'test-package',
          },
          null,
          2
        )
      );

      const newVersion = await taskRules.bumpVersion('patch');
      assert.strictEqual(newVersion, null);
    });
  });

  describe('handlePostCompletion()', () => {
    let packagePath;

    beforeEach(async () => {
      packagePath = join(tempDir, 'package.json');

      // Create test package.json
      await fs.writeFile(
        packagePath,
        JSON.stringify(
          {
            name: 'test-package',
            version: '1.0.0',
          },
          null,
          2
        )
      );

      process.chdir(tempDir);
    });

    it('should handle version bump in AI mode', async () => {
      process.env.CLAUDE_CODE = '1';

      const results = await taskRules.handlePostCompletion('TASK-001', {
        forceBump: true,
      });

      assert.strictEqual(typeof results, 'object');
      assert.strictEqual(typeof results.versionBumped, 'boolean');
      assert.strictEqual(typeof results.newVersion, 'string');
    });

    it('should not bump version in human mode without force', async () => {
      delete process.env.CLAUDE_CODE;

      const results = await taskRules.handlePostCompletion('TASK-001', {});

      assert.strictEqual(results.versionBumped, false);
      assert.strictEqual(results.newVersion, null);
    });

    it('should force version bump when requested', async () => {
      delete process.env.CLAUDE_CODE;

      const results = await taskRules.handlePostCompletion('TASK-001', {
        forceBump: true,
      });

      assert.strictEqual(results.versionBumped, true);
      assert.strictEqual(typeof results.newVersion, 'string');
    });
  });

  describe('generateAutoCommitMessage()', () => {
    it('should generate commit message with task ID', async () => {
      const message = await taskRules.generateAutoCommitMessage('TASK-001');

      assert.strictEqual(typeof message, 'string');
      assert(message.includes('TASK-001'));
      assert(message.includes('feat:'));
      assert(message.includes('Auto-committed by taskwerk'));
    });

    it('should include version in commit message', async () => {
      const message = await taskRules.generateAutoCommitMessage('TASK-001', '1.2.3');

      assert(message.includes('TASK-001'));
      assert(message.includes('Version: 1.2.3'));
    });
  });

  describe('getDefaultRules()', () => {
    it('should return valid default rules structure', () => {
      const rules = taskRules.getDefaultRules();

      // Check structure
      assert.strictEqual(typeof rules, 'object');
      assert.strictEqual(typeof rules.ai, 'object');
      assert.strictEqual(typeof rules.human, 'object');
      assert.strictEqual(typeof rules.global, 'object');

      // Check AI rules
      assert.strictEqual(typeof rules.ai.enforceWorkflow, 'boolean');
      assert.strictEqual(Array.isArray(rules.ai.requiredPhases), true);
      assert.strictEqual(typeof rules.ai.qualityGates, 'object');
      assert.strictEqual(typeof rules.ai.commitRules, 'object');

      // Check quality gates
      assert.strictEqual(typeof rules.ai.qualityGates.testsRequired, 'boolean');
      assert.strictEqual(typeof rules.ai.qualityGates.testsMustPass, 'boolean');
      assert.strictEqual(typeof rules.ai.qualityGates.documentationRequired, 'boolean');

      // Check commit rules
      assert.strictEqual(typeof rules.ai.commitRules.autoCommit, 'boolean');
      assert.strictEqual(typeof rules.ai.commitRules.autoVersionBump, 'boolean');
      assert.strictEqual(typeof rules.ai.commitRules.versionBumpType, 'string');
    });
  });

  describe('generateRulesMarkdown()', () => {
    it('should generate valid markdown documentation', () => {
      const rules = taskRules.getDefaultRules();
      const markdown = taskRules.generateRulesMarkdown(rules);

      assert.strictEqual(typeof markdown, 'string');
      assert(markdown.includes('# taskwerk Workflow Rules'));
      assert(markdown.includes('## AI Agent Workflow Rules'));
      assert(markdown.includes('## Human Workflow Rules'));
      assert(markdown.includes('### Quality Gates'));
      assert(markdown.includes('### Commit Rules'));
      assert(markdown.includes('## Workflow Automation'));
    });
  });
});
