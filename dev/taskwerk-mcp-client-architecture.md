# Taskwerk as MCP Client Architecture

## Vision
Taskwerk becomes an intelligent orchestration layer that connects to MCP servers (like Claude) to execute complex workflows while maintaining control, quality, and safety.

## Core Concept

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│     Human       │────▶│   Taskwerk   │────▶│   MCP Server    │
│  (High-level    │     │ (Orchestrator │     │  (Claude, etc)  │
│   intent)       │     │  + Enforcer)  │     │  (Executor)     │
└─────────────────┘     └──────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ Local Tools  │
                        │ - Git        │
                        │ - Tests      │
                        │ - Build      │
                        └──────────────┘
```

## Intent Loop Architecture

### 1. Intent Analysis Phase
Both `ask` and `agent` commands share the same intent analysis:

```javascript
class IntentAnalyzer {
  async analyze(userInput) {
    return {
      type: 'implementation|debugging|planning|workflow',
      confidence: 0.95,
      steps: [
        { description: 'Set up authentication', complexity: 'high' },
        { description: 'Create user model', complexity: 'medium' },
        { description: 'Add tests', complexity: 'medium' }
      ],
      risks: ['database migration needed', 'breaking API change'],
      dependencies: ['needs database', 'requires npm packages']
    };
  }
}
```

### 2. Plan Generation Phase
Convert intent into executable plan:

```javascript
class PlanGenerator {
  async generate(intent, mode) {
    const plan = {
      id: 'PLAN-001',
      title: intent.summary,
      mode: mode, // 'ask' or 'agent'
      tasks: [],
      checkpoints: [],
      rollbackPoints: []
    };

    // Generate tasks from steps
    for (const step of intent.steps) {
      plan.tasks.push({
        id: generateTaskId(),
        name: step.description,
        requirements: this.generateRequirements(step),
        acceptanceCriteria: this.generateCriteria(step),
        estimatedActions: step.complexity === 'high' ? 10 : 5
      });
    }

    // Add checkpoints for agent mode
    if (mode === 'agent') {
      plan.checkpoints = [
        { after: 'task-3', action: 'run tests' },
        { after: 'task-5', action: 'human review' },
        { after: 'task-7', action: 'build verification' }
      ];
    }

    return plan;
  }
}
```

### 3. Execution Phase Differences

#### Ask Mode (Read-only)
```javascript
class AskExecutor {
  async execute(plan) {
    for (const task of plan.tasks) {
      // Only provide information
      const details = await this.mcp.request('explain_task', task);
      console.log(`\n📖 ${task.name}:`);
      console.log(details);
      
      // Show what WOULD be done
      const actions = await this.mcp.request('plan_actions', task);
      console.log('\n🔍 Steps needed:');
      actions.forEach(a => console.log(`  - ${a}`));
    }
  }
}
```

#### Agent Mode (Full execution)
```javascript
class AgentExecutor {
  async execute(plan) {
    for (const task of plan.tasks) {
      console.log(`\n🚀 Executing: ${task.name}`);
      
      // Create task in Taskwerk
      await this.taskwerk.createTask(task);
      
      // Execute via MCP
      const result = await this.mcp.request('execute_task', {
        task: task,
        context: this.gatherContext()
      });
      
      // Local verification
      if (task.requirements.includes('tests')) {
        const testResult = await this.runTests();
        if (!testResult.passed) {
          await this.rollback(task);
          throw new Error('Tests failed');
        }
      }
      
      // Checkpoint handling
      const checkpoint = plan.checkpoints.find(c => c.after === task.id);
      if (checkpoint) {
        await this.handleCheckpoint(checkpoint);
      }
      
      // Update task status
      await this.taskwerk.updateTask(task.id, { status: 'done' });
    }
  }
}
```

## MCP Client Implementation

### 1. Connection Management
```javascript
class MCPClient {
  constructor(config) {
    this.servers = new Map();
    this.activeConnections = new Map();
  }

  async connect(serverUrl, options = {}) {
    const connection = await this.establishConnection(serverUrl);
    
    // Discover capabilities
    const capabilities = await connection.request('server.capabilities');
    
    this.activeConnections.set(serverUrl, {
      connection,
      capabilities,
      tools: capabilities.tools || []
    });
  }

  async execute(server, tool, params) {
    const conn = this.activeConnections.get(server);
    if (!conn) throw new Error('Not connected to server');
    
    // Check if tool is available
    if (!conn.tools.includes(tool)) {
      throw new Error(`Tool ${tool} not available on ${server}`);
    }
    
    return await conn.connection.request(tool, params);
  }
}
```

### 2. Workflow Orchestration
```javascript
class WorkflowOrchestrator {
  constructor(taskwerk, mcpClient) {
    this.taskwerk = taskwerk;
    this.mcp = mcpClient;
    this.workflows = new Map();
  }

  async executeWorkflow(definition) {
    const workflow = {
      id: generateId(),
      status: 'running',
      steps: definition.steps,
      currentStep: 0,
      context: {}
    };

    for (const step of workflow.steps) {
      // Determine which MCP server to use
      const server = this.selectServer(step.requirements);
      
      // Execute step
      const result = await this.executeStep(step, server);
      
      // Update context for next steps
      workflow.context[step.name] = result;
      
      // Check conditions
      if (step.condition && !this.evaluateCondition(step.condition, workflow.context)) {
        continue; // Skip this step
      }
      
      // Human approval if needed
      if (step.requiresApproval) {
        await this.requestApproval(step, result);
      }
    }
  }
}
```

## Real-World Use Cases

### 1. Code Development Workflow
```yaml
workflow: implement-feature
steps:
  - name: analyze-requirements
    server: claude-mcp
    tool: analyze_requirements
    input: requirements.md
    
  - name: create-tasks
    server: local
    tool: taskwerk_create_tasks
    input: ${analyze-requirements.output}
    
  - name: implement-backend
    server: claude-mcp
    tool: write_code
    input: ${create-tasks.backend_task}
    requirements:
      - language: python
      - framework: fastapi
      
  - name: run-tests
    server: local
    tool: pytest
    condition: ${implement-backend.success}
    
  - name: implement-frontend
    server: claude-mcp
    tool: write_code
    input: ${create-tasks.frontend_task}
    parallel: true  # Can run while backend tests run
    
  - name: integration-test
    server: local
    tool: integration_tests
    requires: [implement-backend, implement-frontend]
    
  - name: create-pr
    server: github-mcp
    tool: create_pull_request
    requiresApproval: true
```

### 2. Non-Code Workflow: Research & Documentation
```yaml
workflow: research-topic
steps:
  - name: gather-sources
    server: perplexity-mcp
    tool: web_search
    input: ${topic}
    
  - name: analyze-sources
    server: claude-mcp
    tool: analyze_documents
    input: ${gather-sources.results}
    
  - name: create-outline
    server: claude-mcp
    tool: create_outline
    
  - name: write-sections
    server: claude-mcp
    tool: write_content
    parallel: true
    forEach: ${create-outline.sections}
    
  - name: review-and-edit
    server: claude-mcp
    tool: edit_document
    requiresApproval: true
    
  - name: publish
    server: cms-mcp
    tool: publish_article
```

## Enforcement & Safety

### 1. Release Rules
```javascript
class ReleaseEnforcer {
  constructor(rules) {
    this.rules = rules;
  }

  async canRelease(context) {
    const checks = [
      this.checkTests(context),
      this.checkCoverage(context),
      this.checkLinting(context),
      this.checkSecurityScan(context),
      this.checkChangelogUpdated(context),
      this.checkPeerReview(context)
    ];

    const results = await Promise.all(checks);
    return results.every(r => r.passed);
  }

  async enforceGitFlow(branch, action) {
    // Prevent direct commits to main
    if (branch === 'main' && action === 'commit') {
      throw new Error('Direct commits to main are not allowed');
    }
    
    // Ensure PR exists for feature branches
    if (branch.startsWith('feature/') && action === 'merge') {
      const pr = await this.github.getPR(branch);
      if (!pr || !pr.approved) {
        throw new Error('PR must be approved before merging');
      }
    }
  }
}
```

### 2. Quality Gates
```javascript
class QualityGate {
  async check(artifact, type) {
    const gates = {
      code: [
        { name: 'tests', fn: this.runTests },
        { name: 'coverage', fn: this.checkCoverage, threshold: 80 },
        { name: 'complexity', fn: this.checkComplexity, threshold: 10 },
        { name: 'security', fn: this.runSecurityScan }
      ],
      documentation: [
        { name: 'spelling', fn: this.checkSpelling },
        { name: 'links', fn: this.checkLinks },
        { name: 'readability', fn: this.checkReadability }
      ]
    };

    const checks = gates[type] || [];
    for (const check of checks) {
      const result = await check.fn(artifact);
      if (!result.passed) {
        throw new Error(`Quality gate failed: ${check.name}`);
      }
    }
  }
}
```

## Configuration Example

```yaml
# .taskwerk/mcp-config.yml
servers:
  claude:
    url: mcp://claude.anthropic.com
    auth: ${ANTHROPIC_API_KEY}
    capabilities:
      - code_generation
      - analysis
      - planning
      
  github:
    url: mcp://github.com/api
    auth: ${GITHUB_TOKEN}
    capabilities:
      - repository_management
      - pull_requests
      
  local:
    url: mcp://localhost:8080
    capabilities:
      - file_system
      - command_execution
      - testing

workflows:
  default:
    enforcement:
      - no_direct_commits_to_main
      - tests_must_pass
      - require_pr_approval
      
    quality_gates:
      - min_coverage: 80
      - max_complexity: 10
      - security_scan: true
      
    checkpoints:
      - after_task_count: 5
        action: human_review
      - on_error: rollback_and_notify
```

## Benefits of This Architecture

1. **Separation of Concerns**
   - Taskwerk: Orchestration, enforcement, task management
   - MCP Servers: Execution, specialized capabilities
   - Local Tools: Verification, testing, building

2. **Flexibility**
   - Swap MCP servers based on capabilities
   - Mix AI and traditional tools
   - Support any workflow type

3. **Safety & Control**
   - Checkpoints for human review
   - Automatic rollback capability
   - Enforcement of team standards
   - Quality gates before proceeding

4. **Scalability**
   - Parallel execution where possible
   - Distributed work across multiple MCP servers
   - Queue management for long-running tasks

This positions Taskwerk as the "conductor" of an orchestra of tools, maintaining the high-level view while delegating execution to specialized services.