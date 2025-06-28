import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * TaskRules manages workflow rules and development hygiene enforcement
 * when AI agents take on tasks vs manual human task management
 */
export class TaskRules {
  constructor(config) {
    this.config = config;
    this.rulesFile = join(process.cwd(), 'tasks', 'taskwerk-rules.md');
    this.rules = null;
  }

  /**
   * Detect if current session is AI-driven or human-driven
   */
  async detectWorkflowMode() {
    const session = await this.getCurrentSession();

    // Check various indicators of AI workflow
    const indicators = {
      isClaudeCode: !!process.env.CLAUDE_CODE,
      isCursor: !!process.env.CURSOR,
      isCopilot: !!process.env.COPILOT,
      agentFlag: session?.agent && session.agent !== 'CLI',
      aiTaskPattern: session?.currentTask && (await this.isAIInitiatedTask(session.currentTask)),
    };

    // Determine mode based on indicators
    if (indicators.isClaudeCode || indicators.isCursor || indicators.agentFlag) {
      return 'ai';
    }

    return 'human';
  }

  /**
   * Load task rules from taskwerk-rules.md or create default
   */
  async loadRules() {
    if (this.rules) {
      return this.rules;
    }

    try {
      const rulesContent = await readFile(this.rulesFile, 'utf8');
      this.rules = this.parseRulesFile(rulesContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Create default rules file
        this.rules = this.getDefaultRules();
        await this.saveDefaultRulesFile();
      } else {
        throw error;
      }
    }

    return this.rules;
  }

  /**
   * Get default rules configuration
   */
  getDefaultRules() {
    return {
      ai: {
        enforceWorkflow: true,
        requiredPhases: ['plan', 'implement', 'test', 'document'],
        qualityGates: {
          testsRequired: true,
          testsMustPass: true,
          documentationRequired: true,
          lintingRequired: true,
          typeCheckRequired: true,
        },
        commitRules: {
          autoCommit: false,
          requireAllPhases: true,
          versionBumpRequired: true,
          versionBumpType: 'patch', // patch, minor, major
          autoVersionBump: true,
          autoStage: true,
        },
        timeouts: {
          maxTaskDuration: '4h',
          phaseTimeout: '30m',
        },
      },
      human: {
        enforceWorkflow: false,
        requiredPhases: [], // No enforcement for human workflows
        qualityGates: {
          testsRequired: false,
          testsMustPass: false,
          documentationRequired: false,
          lintingRequired: false,
          typeCheckRequired: false,
        },
        commitRules: {
          autoCommit: false,
          requireAllPhases: false,
          versionBumpRequired: false,
          versionBumpType: 'patch',
          autoVersionBump: false,
          autoStage: false,
        },
      },
      global: {
        rulesFile: 'tasks/taskwerk-rules.md',
        logWorkflow: true,
        enableRules: true,
      },
    };
  }

  /**
   * Parse rules from markdown file
   */
  parseRulesFile(_content) {
    // This would parse the markdown structure and extract rules
    // For now, return default rules (full implementation would parse markdown)
    return this.getDefaultRules();
  }

  /**
   * Save default rules file as markdown documentation
   */
  async saveDefaultRulesFile() {
    const rulesMarkdown = this.generateRulesMarkdown(this.rules);
    await writeFile(this.rulesFile, rulesMarkdown, 'utf8');
  }

  /**
   * Generate human-readable rules markdown
   */
  generateRulesMarkdown(rules) {
    return `# TaskWerk Workflow Rules

This file defines workflow rules and development hygiene enforcement for TaskWerk.
Rules are applied differently based on whether tasks are handled by AI agents or humans.

## AI Agent Workflow Rules

When AI agents (Claude Code, Cursor, etc.) take on tasks, the following rules are enforced:

### Required Workflow Phases
${rules.ai.requiredPhases.map(phase => `- **${phase}**: ${this.getPhaseDescription(phase)}`).join('\n')}

### Quality Gates
- **Tests Required**: ${rules.ai.qualityGates.testsRequired ? 'Yes' : 'No'}
- **Tests Must Pass**: ${rules.ai.qualityGates.testsMustPass ? 'Yes' : 'No'}
- **Documentation Required**: ${rules.ai.qualityGates.documentationRequired ? 'Yes' : 'No'}
- **Linting Required**: ${rules.ai.qualityGates.lintingRequired ? 'Yes' : 'No'}
- **Type Checking Required**: ${rules.ai.qualityGates.typeCheckRequired ? 'Yes' : 'No'}

### Commit Rules
- **Auto Commit**: ${rules.ai.commitRules.autoCommit ? 'Enabled' : 'Disabled'}
- **Require All Phases**: ${rules.ai.commitRules.requireAllPhases ? 'Yes' : 'No'}
- **Version Bump Required**: ${rules.ai.commitRules.versionBumpRequired ? 'Yes' : 'No'}
- **Auto Version Bump**: ${rules.ai.commitRules.autoVersionBump ? 'Enabled' : 'Disabled'}
- **Version Bump Type**: ${rules.ai.commitRules.versionBumpType}
- **Auto Stage Files**: ${rules.ai.commitRules.autoStage ? 'Enabled' : 'Disabled'}

### Timeouts
- **Max Task Duration**: ${rules.ai.timeouts.maxTaskDuration}
- **Phase Timeout**: ${rules.ai.timeouts.phaseTimeout}

## Human Workflow Rules

When humans manage tasks manually, workflow enforcement is minimal:

- **Workflow Enforcement**: ${rules.human.enforceWorkflow ? 'Enabled' : 'Disabled'}
- **Required Phases**: ${rules.human.requiredPhases.length > 0 ? rules.human.requiredPhases.join(', ') : 'None'}
- **Quality Gates**: ${Object.values(rules.human.qualityGates).some(Boolean) ? 'Some enforced' : 'None enforced'}

## Configuration

To customize these rules:

1. Edit this file directly
2. Modify \`.taskrc.json\` configuration
3. Use \`taskwerk rules\` command to manage rules interactively

## Workflow Phases

### Plan
- Create implementation plan
- Identify dependencies and requirements
- Estimate complexity and timeline

### Implement
- Write the actual code
- Follow project coding standards
- Implement error handling

### Test
- Write unit tests for new functionality
- Ensure all tests pass
- Achieve required coverage thresholds

### Document
- Add/update docstrings and comments
- Update README if needed
- Create usage examples

## Quality Gates Details

### Tests Required
When enabled, all new functionality must include tests:
- Unit tests for functions/methods
- Integration tests for complex workflows
- Edge case coverage

### Documentation Required
When enabled, all new functionality must include:
- Function/method docstrings
- Usage examples
- Updated README sections if applicable

### Linting Required
When enabled, code must pass:
- ESLint checks (JavaScript/TypeScript)
- Prettier formatting
- Project-specific linting rules

### Type Checking Required
When enabled, code must pass:
- TypeScript type checking
- JSDoc type annotations (JavaScript)
- No \`any\` types without justification

## Workflow Automation

TaskWerk can automate version management and git operations based on workflow rules:

### Version Bumping
- **Automatic**: Version is bumped automatically when tasks are completed in AI mode
- **Types**: patch (0.1.0 → 0.1.1), minor (0.1.0 → 0.2.0), major (0.1.0 → 1.0.0)
- **Manual Override**: Use \`--version-impact\` flag to override automatic detection

### Auto-Staging
- **Automatic**: Changed files are automatically staged for commit
- **Scope**: Includes modified files and new untracked files
- **Manual Override**: Use \`--auto-stage\` flag to force staging

### Auto-Commit
- **Automatic**: Creates commits automatically after task completion
- **Message Format**: Follows conventional commit format with task details
- **Manual Override**: Use \`--auto-commit\` flag to force commits

### Integration Commands
\`\`\`bash
# Complete task with full automation
taskwerk complete TASK-001 --auto-stage --auto-commit

# Complete with specific version bump
taskwerk complete TASK-001 --version-impact minor --auto-commit

# Force automation in human mode
taskwerk complete TASK-001 --auto-stage --auto-commit --force
\`\`\`

---

*This file was generated by TaskWerk. You can edit it manually or use \`taskwerk rules\` to modify settings.*
`;
  }

  /**
   * Get description for workflow phase
   */
  getPhaseDescription(phase) {
    const descriptions = {
      plan: 'Create implementation plan and identify requirements',
      implement: 'Write the actual code following project standards',
      test: 'Write and run tests to ensure functionality works correctly',
      document: 'Add documentation, comments, and usage examples',
    };
    return descriptions[phase] || 'Custom workflow phase';
  }

  /**
   * Check if a task was initiated by AI
   */
  async isAIInitiatedTask(_taskId) {
    // Check task metadata to see if it was created via AI agent
    // This would examine task creation context, agent flags, etc.
    return false; // Placeholder implementation
  }

  /**
   * Get current session (placeholder - would use SessionManager)
   */
  async getCurrentSession() {
    // This would use the actual SessionManager
    return {
      agent: process.env.CLAUDE_CODE ? 'Claude Code' : 'CLI',
      currentTask: null,
    };
  }

  /**
   * Validate task against current workflow rules
   */
  async validateTask(taskId, phase = 'implement') {
    const rules = await this.loadRules();
    const mode = await this.detectWorkflowMode();

    if (!rules[mode].enforceWorkflow) {
      return { valid: true, warnings: [], errors: [] };
    }

    const validation = {
      valid: true,
      warnings: [],
      errors: [],
      requiredActions: [],
    };

    // Validate required phases
    if (rules[mode].requiredPhases.includes(phase)) {
      const phaseValidation = await this.validatePhase(taskId, phase, rules[mode]);
      validation.warnings.push(...phaseValidation.warnings);
      validation.errors.push(...phaseValidation.errors);
      validation.requiredActions.push(...phaseValidation.requiredActions);

      if (phaseValidation.errors.length > 0) {
        validation.valid = false;
      }
    }

    return validation;
  }

  /**
   * Validate specific workflow phase
   */
  async validatePhase(taskId, phase, rules) {
    const validation = {
      warnings: [],
      errors: [],
      requiredActions: [],
    };

    switch (phase) {
      case 'test':
        return await this.validateTestPhase(taskId, rules);
      case 'document':
        return await this.validateDocumentPhase(taskId, rules);
      case 'implement':
        return await this.validateImplementPhase(taskId, rules);
      default:
        return validation;
    }
  }

  /**
   * Validate test phase requirements
   */
  async validateTestPhase(taskId, rules) {
    const validation = { warnings: [], errors: [], requiredActions: [] };

    if (rules.qualityGates.testsRequired) {
      // Check if tests exist for the task
      const hasTests = await this.checkTestsExist(taskId);
      if (!hasTests) {
        validation.errors.push('Tests are required but not found');
        validation.requiredActions.push('Write unit tests for new functionality');
      }
    }

    if (rules.qualityGates.testsMustPass) {
      // Check if tests pass
      const testsPass = await this.runTests();
      if (!testsPass) {
        validation.errors.push('All tests must pass before task completion');
        validation.requiredActions.push('Fix failing tests');
      }
    }

    return validation;
  }

  /**
   * Validate documentation phase requirements
   */
  async validateDocumentPhase(taskId, rules) {
    const validation = { warnings: [], errors: [], requiredActions: [] };

    if (rules.qualityGates.documentationRequired) {
      const docValidation = await this.checkDocumentation(taskId);
      if (!docValidation.adequate) {
        validation.warnings.push('Documentation may be insufficient');
        validation.requiredActions.push('Add docstrings and usage examples');
      }
    }

    return validation;
  }

  /**
   * Validate implementation phase requirements
   */
  async validateImplementPhase(taskId, rules) {
    const validation = { warnings: [], errors: [], requiredActions: [] };

    if (rules.qualityGates.lintingRequired) {
      const lintPassing = await this.runLinting();
      if (!lintPassing) {
        validation.errors.push('Code must pass linting checks');
        validation.requiredActions.push('Fix linting errors');
      }
    }

    if (rules.qualityGates.typeCheckRequired) {
      const typesPassing = await this.runTypeCheck();
      if (!typesPassing) {
        validation.errors.push('Code must pass type checking');
        validation.requiredActions.push('Fix type errors');
      }
    }

    return validation;
  }

  /**
   * Check if tests exist for a task
   */
  async checkTestsExist(_taskId) {
    // Implementation would check for test files related to the task
    return false; // Placeholder
  }

  /**
   * Run tests and return pass/fail status
   */
  async runTests() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      await execAsync('npm test');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run linting and return pass/fail status
   */
  async runLinting() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      await execAsync('npm run lint');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Run type checking and return pass/fail status
   */
  async runTypeCheck() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Try TypeScript check if available
      await execAsync('npx tsc --noEmit');
      return true;
    } catch (error) {
      // TypeScript not available or errors found
      return true; // Don't fail if TypeScript isn't used
    }
  }

  /**
   * Check documentation adequacy
   */
  async checkDocumentation(_taskId) {
    // Implementation would analyze code for docstrings, comments, etc.
    return { adequate: true, suggestions: [] }; // Placeholder
  }

  /**
   * Get workflow phase for a task
   */
  async getTaskPhase(_taskId) {
    // Implementation would track task phases
    return 'implement'; // Placeholder
  }

  /**
   * Set workflow phase for a task
   */
  async setTaskPhase(taskId, phase) {
    // Implementation would update task metadata
    console.log(`Task ${taskId} moved to phase: ${phase}`);
  }

  /**
   * Handle post-completion workflow (version bump, auto-stage, auto-commit)
   */
  async handlePostCompletion(taskId, options = {}) {
    const rules = await this.loadRules();
    const mode = await this.detectWorkflowMode();
    const commitRules = rules[mode].commitRules;

    const results = {
      versionBumped: false,
      filesStaged: false,
      committed: false,
      newVersion: null,
      commitHash: null,
    };

    // Auto version bump
    if (commitRules.autoVersionBump || options.forceBump) {
      const versionType = options.versionImpact || commitRules.versionBumpType;
      results.newVersion = await this.bumpVersion(versionType);
      results.versionBumped = true;
      console.log(`📈 Version bumped (${versionType}): ${results.newVersion}`);
    }

    // Auto stage files
    if (commitRules.autoStage || options.forceStage) {
      const stagedCount = await this.autoStageFiles();
      results.filesStaged = stagedCount > 0;
      if (stagedCount > 0) {
        console.log(`📁 Auto-staged ${stagedCount} file(s)`);
      }
    }

    // Auto commit
    if (commitRules.autoCommit || options.forceCommit) {
      results.commitHash = await this.autoCommit(taskId, results.newVersion);
      results.committed = !!results.commitHash;
      if (results.committed) {
        console.log(`✅ Auto-committed changes: ${results.commitHash}`);
      }
    }

    return results;
  }

  /**
   * Bump version in package.json
   */
  async bumpVersion(type = 'patch') {
    try {
      const { readFile, writeFile } = await import('fs/promises');
      const packagePath = './package.json';

      const packageContent = await readFile(packagePath, 'utf8');
      const packageData = JSON.parse(packageContent);

      if (!packageData.version) {
        throw new Error('No version field found in package.json');
      }

      const [major, minor, patch] = packageData.version.split('.').map(Number);

      let newVersion;
      switch (type) {
        case 'major':
          newVersion = `${major + 1}.0.0`;
          break;
        case 'minor':
          newVersion = `${major}.${minor + 1}.0`;
          break;
        case 'patch':
          newVersion = `${major}.${minor}.${patch + 1}`;
          break;
        default:
          throw new Error(`Invalid version bump type: ${type}`);
      }

      packageData.version = newVersion;
      await writeFile(packagePath, JSON.stringify(packageData, null, 2) + '\n');

      return newVersion;
    } catch (error) {
      console.error(`⚠️  Failed to bump version: ${error.message}`);
      return null;
    }
  }

  /**
   * Auto-stage files using git
   */
  async autoStageFiles() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Get changed files
      const { stdout: changedFiles } = await execAsync('git diff --name-only');
      const { stdout: untrackedFiles } = await execAsync(
        'git ls-files --others --exclude-standard'
      );

      const allFiles = [
        ...changedFiles
          .trim()
          .split('\n')
          .filter(f => f),
        ...untrackedFiles
          .trim()
          .split('\n')
          .filter(f => f),
      ];

      if (allFiles.length === 0) {
        return 0;
      }

      // Stage all files
      await execAsync('git add .');
      return allFiles.length;
    } catch (error) {
      console.error(`⚠️  Failed to auto-stage files: ${error.message}`);
      return 0;
    }
  }

  /**
   * Auto-commit with generated message
   */
  async autoCommit(taskId, newVersion = null) {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Check if there are staged files
      const { stdout: stagedFiles } = await execAsync('git diff --cached --name-only');
      if (!stagedFiles.trim()) {
        console.log('⚠️  No staged files for auto-commit');
        return null;
      }

      // Generate commit message
      const commitMessage = await this.generateAutoCommitMessage(taskId, newVersion);

      // Create commit
      await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

      // Get commit hash
      const { stdout: commitHash } = await execAsync('git rev-parse HEAD');
      return commitHash.trim().substring(0, 7);
    } catch (error) {
      console.error(`⚠️  Failed to auto-commit: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate commit message for auto-commit
   */
  async generateAutoCommitMessage(taskId, newVersion = null) {
    // Get task details (this would integrate with TaskManager)
    const taskDescription = `Complete ${taskId}`; // Placeholder - would get actual description

    let message = `feat: ${taskDescription}`;

    if (newVersion) {
      message += `\n\nVersion: ${newVersion}`;
    }

    message += `\n\nAuto-committed by TaskWerk workflow rules`;

    return message;
  }
}
