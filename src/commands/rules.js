import { TaskRules } from '../core/task-rules.js';
import { loadConfig } from '../utils/config.js';

export async function rulesCommand(options) {
  try {
    const config = await loadConfig();
    const taskRules = new TaskRules(config);

    if (options.init) {
      await initializeRules(taskRules);
    } else if (options.validate) {
      await validateCurrentTask(taskRules, options.validate);
    } else if (options.mode) {
      await showWorkflowMode(taskRules);
    } else if (options.status) {
      await showRulesStatus(taskRules);
    } else {
      await showRulesOverview(taskRules);
    }
  } catch (error) {
    console.error('❌ Failed to manage rules:', error.message);
    process.exit(1);
  }
}

async function initializeRules(taskRules) {
  console.log('🔧 Initializing TaskWerk workflow rules...');

  const rules = await taskRules.loadRules();
  const mode = await taskRules.detectWorkflowMode();

  console.log(`\n✅ Rules initialized successfully`);
  console.log(`📋 Rules file: tasks/taskwerk-rules.md`);
  console.log(`🤖 Current mode: ${mode.toUpperCase()}`);
  console.log(`⚡ Workflow enforcement: ${rules[mode].enforceWorkflow ? 'ENABLED' : 'DISABLED'}`);

  if (rules[mode].enforceWorkflow) {
    console.log(`\n📝 Required phases: ${rules[mode].requiredPhases.join(', ')}`);
    console.log(
      `🧪 Quality gates: ${Object.entries(rules[mode].qualityGates)
        .filter(([_k, v]) => v)
        .map(([k, _v]) => k)
        .join(', ')}`
    );
  }

  console.log(`\n💡 Edit 'tasks/taskwerk-rules.md' to customize workflow rules`);
  console.log(`💡 Use 'taskwerk rules --status' to check current status`);
}

async function validateCurrentTask(taskRules, taskId) {
  console.log(`🔍 Validating task: ${taskId}`);

  const validation = await taskRules.validateTask(taskId);
  const mode = await taskRules.detectWorkflowMode();

  console.log(`\n🤖 Workflow mode: ${mode.toUpperCase()}`);
  console.log(`✅ Task validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);

  if (validation.warnings?.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    for (const warning of validation.warnings) {
      console.log(`   - ${warning}`);
    }
  }

  if (validation.errors?.length > 0) {
    console.log(`\n❌ Errors:`);
    for (const error of validation.errors) {
      console.log(`   - ${error}`);
    }
  }

  if (validation.requiredActions?.length > 0) {
    console.log(`\n🔧 Required actions:`);
    for (const action of validation.requiredActions) {
      console.log(`   - ${action}`);
    }
  }

  if (validation.valid) {
    console.log(`\n💚 Task is ready for the next phase`);
  } else {
    console.log(`\n💡 Complete required actions before proceeding`);
  }
}

async function showWorkflowMode(taskRules) {
  const mode = await taskRules.detectWorkflowMode();
  const rules = await taskRules.loadRules();

  console.log(`🤖 Current workflow mode: ${mode.toUpperCase()}`);
  console.log(`\n📋 Mode details:`);
  console.log(`   Enforcement: ${rules[mode].enforceWorkflow ? 'ENABLED' : 'DISABLED'}`);
  console.log(
    `   Required phases: ${rules[mode]?.requiredPhases?.length > 0 ? rules[mode].requiredPhases.join(', ') : 'None'}`
  );

  const enabledGates = Object.entries(rules[mode]?.qualityGates || {})
    .filter(([_k, v]) => v)
    .map(([k, _v]) => k);
  console.log(`   Quality gates: ${enabledGates.length > 0 ? enabledGates.join(', ') : 'None'}`);

  if (mode === 'ai') {
    console.log(`\n🔧 AI mode indicators detected:`);
    if (process.env.CLAUDE_CODE) {
      console.log(`   - Claude Code environment`);
    }
    if (process.env.CURSOR) {
      console.log(`   - Cursor environment`);
    }
    if (process.env.COPILOT) {
      console.log(`   - GitHub Copilot`);
    }
  }
}

async function showRulesStatus(taskRules) {
  const rules = await taskRules.loadRules();
  const mode = await taskRules.detectWorkflowMode();

  console.log(`📋 TaskWerk Rules Status`);
  console.log(`\n🤖 Current Mode: ${mode.toUpperCase()}`);
  console.log(`⚡ Enforcement: ${rules[mode].enforceWorkflow ? 'ENABLED' : 'DISABLED'}`);

  if (rules[mode].enforceWorkflow) {
    console.log(`\n📝 Workflow Requirements:`);
    console.log(`   Required Phases: ${rules[mode].requiredPhases.join(', ')}`);

    console.log(`\n🛡️  Quality Gates:`);
    for (const [gate, enabled] of Object.entries(rules[mode].qualityGates)) {
      console.log(`   ${enabled ? '✅' : '❌'} ${gate}`);
    }

    console.log(`\n📦 Commit Rules:`);
    for (const [rule, value] of Object.entries(rules[mode].commitRules)) {
      console.log(`   ${rule}: ${value}`);
    }

    if (rules[mode].timeouts) {
      console.log(`\n⏱️  Timeouts:`);
      for (const [timeout, value] of Object.entries(rules[mode].timeouts)) {
        console.log(`   ${timeout}: ${value}`);
      }
    }
  }

  console.log(`\n📁 Configuration:`);
  console.log(`   Rules file: tasks/taskwerk-rules.md`);
  console.log(`   Config file: .taskrc.json`);
  console.log(`   Global rules enabled: ${rules.global.enableRules ? 'Yes' : 'No'}`);
  console.log(`   Workflow logging: ${rules.global.logWorkflow ? 'Yes' : 'No'}`);
}

async function showRulesOverview(taskRules) {
  const rules = await taskRules.loadRules();
  const mode = await taskRules.detectWorkflowMode();

  console.log(`📋 TaskWerk Workflow Rules`);
  console.log(`\n🤖 Current mode: ${mode.toUpperCase()}`);
  console.log(`⚡ Enforcement: ${rules[mode].enforceWorkflow ? 'ENABLED' : 'DISABLED'}`);

  if (rules[mode].enforceWorkflow) {
    console.log(`\n📝 This mode enforces:`);
    console.log(`   • ${rules[mode]?.requiredPhases?.length || 0} required workflow phases`);

    const enabledGates = Object.values(rules[mode]?.qualityGates || {}).filter(Boolean).length;
    console.log(`   • ${enabledGates} quality gates`);

    if (rules[mode].commitRules.requireAllPhases) {
      console.log(`   • All phases must complete before commit`);
    }
  } else {
    console.log(`\n💫 This mode allows flexible workflow without enforcement`);
  }

  console.log(`\n🔧 Available commands:`);
  console.log(`   taskwerk rules --init          Initialize rules system`);
  console.log(`   taskwerk rules --status        Show detailed status`);
  console.log(`   taskwerk rules --mode          Show current workflow mode`);
  console.log(`   taskwerk rules --validate TASK-XXX  Validate specific task`);

  console.log(`\n📁 Configuration files:`);
  console.log(`   tasks/taskwerk-rules.md     Workflow rules and documentation`);
  console.log(`   .taskrc.json          TaskWerk configuration`);
}
