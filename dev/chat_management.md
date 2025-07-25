# Chat Management Architecture

## Overview
Chat management enables Taskwerk's intent loop to understand context-dependent requests like "use the approach we discussed" or "make it async this time". This document outlines a pragmatic implementation that enhances Taskwerk without over-engineering.

## Core Design Principles

1. **Simplicity First**: Don't create parallel systems when existing ones work
2. **User Clarity**: Always make it obvious which context is active
3. **Explicit Correlation**: Ask users when linking to existing tasks
4. **Maintain Separation**: Chat context for conversation, tasks for work tracking

## Design Decision: Hybrid Approach

We use a hybrid approach that maintains Taskwerk's single-shot CLI nature while providing conversational capabilities when needed.

### Why Hybrid?
1. **Preserves CLI philosophy**: Each command remains pipeable and scriptable
2. **Progressive enhancement**: Basic usage unchanged, context available when helpful
3. **Clear boundaries**: Users control when context is used
4. **Backward compatible**: Existing workflows continue unchanged

## Database Schema

### Simplified Context Tables

```sql
-- Minimal conversation tracking
CREATE TABLE chat_contexts (
  id TEXT PRIMARY KEY,                    -- Auto-generated: CHAT-001, CHAT-002
  name TEXT NOT NULL,                     -- User-friendly: "auth-implementation"
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,                     -- 'ask' or 'agent'
  first_prompt TEXT,                      -- For auto-naming
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,                   -- For auto-cleanup
  turn_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'            -- 'active', 'completed', 'abandoned'
);

-- Conversation history
CREATE TABLE chat_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  role TEXT NOT NULL,                     -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  created_task_ids JSON,                  -- Array of task IDs created in this turn
  tool_calls JSON,                        -- For debugging/audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (context_id) REFERENCES chat_contexts(id) ON DELETE CASCADE
);

-- Extend existing tasks table
ALTER TABLE tasks ADD COLUMN source TEXT DEFAULT 'cli';      -- 'cli', 'ask', 'agent'
ALTER TABLE tasks ADD COLUMN context_id TEXT;                -- Links to chat context
ALTER TABLE tasks ADD COLUMN intent_group_id TEXT;           -- Groups related intent tasks
ALTER TABLE tasks ADD COLUMN correlation_id INTEGER;          -- Links to existing task

-- Indexes for performance
CREATE INDEX idx_contexts_project ON chat_contexts(project_id);
CREATE INDEX idx_contexts_name ON chat_contexts(name);
CREATE INDEX idx_contexts_expires ON chat_contexts(expires_at);
CREATE INDEX idx_turns_context ON chat_turns(context_id);
CREATE INDEX idx_tasks_source ON tasks(source);
CREATE INDEX idx_tasks_context ON tasks(context_id);
```

## Global vs Project Context

### Context Scope Detection

```javascript
class ContextResolver {
  async getActiveContext(type) {
    const projectId = await this.detectProject();
    
    if (projectId) {
      // In a project directory
      return {
        scope: 'project',
        projectId: projectId,
        contextPath: `.taskwerk/contexts/${type}`,
        display: `[Project: ${projectId}]`
      };
    } else {
      // Global context
      return {
        scope: 'global',
        projectId: 'GLOBAL',
        contextPath: `~/.taskwerk/global-contexts/${type}`,
        display: '[Global]'
      };
    }
  }
}
```

### User Interface Shows Scope

```bash
# In a project directory
$ twrk ask "how do I parse JSON?"
╭─ [Project: my-app] Chat: "parse-json" ─╮
│ To parse JSON in your project...        │
╰─────────────────────────────────────────╯

# Outside any project
$ cd ~
$ twrk ask "how do I parse JSON?"
╭─ [Global] Chat: "parse-json" ─╮
│ To parse JSON, you can...      │
╰────────────────────────────────╯

# Explicitly use global context from within project
$ twrk ask --global "remember this for later"
╭─ [Global] Chat: "remember-for-later" ─╮
│ I'll remember this globally...        │
╰───────────────────────────────────────╯
```

### Benefits of Global Context

1. **Cross-Project Learning**: "Remember how we solved this last time?"
2. **Personal Knowledge Base**: Builds up over time
3. **Quick AI Access**: Use taskwerk as general AI assistant
4. **Persistent History**: Like ~/.bash_history but intelligent

## Chat Context vs Regular Logging

### When to Use Each System

**Regular Logging** (Existing System)
- **Purpose**: System operations, debugging, audit trail
- **Audience**: Developers, system admins
- **Content**: Technical details, errors, performance metrics
- **Storage**: Log files with rotation
- **Examples**:
  ```javascript
  logger.debug('Task creation started', { taskId, params });
  logger.error('Database connection failed', { error });
  logger.info('Migration completed', { duration });
  ```

**Chat Context** (Conversation History)
- **Purpose**: User interaction history, AI context
- **Audience**: End users, AI for understanding
- **Content**: User prompts, AI responses, created tasks
- **Storage**: Database for retrieval and correlation
- **Examples**:
  ```javascript
  context.addTurn('user', 'implement authentication');
  context.addTurn('assistant', 'I\'ll help you...', {
    createdTasks: ['TASK-001', 'TASK-002']
  });
  ```

## Context Lifecycle Management

### Context Creation & Naming
```javascript
class ContextManager {
  async createContext(projectId, type, firstPrompt) {
    // Generate simple ID
    const contextId = await this.generateSimpleId(); // CHAT-001, CHAT-002
    
    // Auto-generate friendly name from prompt
    const name = this.generateName(firstPrompt);
    // "implement user authentication" → "implement-user-auth"
    // "fix the login bug" → "fix-login-bug"
    
    return await this.db.createContext({
      id: contextId,
      name: name,
      project_id: projectId,
      type: type,
      first_prompt: firstPrompt,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  }
  
  generateName(prompt) {
    // Take first 3-4 meaningful words, kebab-case
    const words = prompt.toLowerCase()
      .split(/\s+/)
      .filter(w => !['the', 'a', 'an', 'and', 'or'].includes(w))
      .slice(0, 4);
    return words.join('-');
  }
}
```

### When to Create New Context

1. **Explicit Request**
   - User provides `--new` flag
   - User provides `--context <name>` with new name

2. **Automatic Creation**
   - No active context exists
   - Last context is >1 hour old (configurable)
   - Context type mismatch (ask vs agent)

3. **Never Auto-Create When**
   - User provides `--continue` flag
   - User references previous context explicitly

### When to Update Context

1. **Every Turn**
   - Add user prompt as new turn
   - Add assistant response
   - Update `last_active` timestamp
   - Reset expiry timer

2. **On Task Creation**
   - Link created tasks to context
   - Store which turn created the task

3. **On Tool Usage**
   - Store tool calls and results
   - Maintain audit trail

### When to Clear Context

1. **Automatic Clearing**
   ```javascript
   class ContextCleaner {
     async cleanupExpiredContexts() {
       // Run every hour
       const expired = await this.db.query(
         'SELECT * FROM conversation_contexts WHERE expires_at < ?',
         [new Date()]
       );
       
       for (const context of expired) {
         if (context.status === 'active') {
           // Archive before deletion
           await this.archiveContext(context);
         }
         await this.deleteContext(context.id);
       }
     }
   }
   ```

2. **Manual Clearing**
   - `twrk context clear <id>` - Clear specific
   - `twrk context clear --all` - Clear all
   - `twrk context clear --before <date>` - Clear old

3. **Smart Clearing**
   - On project deletion
   - When switching projects
   - On explicit "start over" intent

## Command Interface

### Basic Usage (Implicit Context)
```bash
# First command - creates new context automatically
$ twrk ask "implement user authentication"
[Context: ASK-2024-01-07-001] I'll help you implement user authentication...

# Second command - auto-continues if within 1 hour
$ twrk ask "use JWT tokens"
[Context: ASK-2024-01-07-001] JWT tokens are a good choice...

# After 1+ hour gap - new context
$ twrk ask "add refresh tokens"
[Context: ASK-2024-01-07-002] To add refresh tokens...
```

### Explicit Context Control
```bash
# Force new context
$ twrk ask --new "different topic"
[Context: ASK-2024-01-07-003] Starting fresh context...

# Continue specific context
$ twrk ask --continue "add that feature we discussed"
[Context: ASK-2024-01-07-001] Continuing our discussion...

# Named contexts for easy reference
$ twrk ask --save-context auth-work "implement authentication"
[Context: auth-work] I'll help with authentication...

$ twrk ask --context auth-work "add password reset"
[Context: auth-work] Adding password reset to our auth system...
```

### Context Management Commands
```bash
# List all contexts
$ twrk context list
ID                    Title                           Last Active    Status
ASK-2024-01-07-001   implement user authentication   5 min ago      active
ASK-2024-01-07-002   add refresh tokens             1 hour ago     active
auth-work            implement authentication        2 hours ago    active

# Show context details
$ twrk context show ASK-2024-01-07-001
Context: ASK-2024-01-07-001
Created: 2024-01-07 10:00:00
Last Active: 2024-01-07 10:05:00
Turns: 3
Tasks Created: 2 (TASK-001, TASK-002)

Recent History:
1. User: implement user authentication
2. Assistant: I'll help you implement user authentication...
3. User: use JWT tokens
4. Assistant: JWT tokens are a good choice...

# Clear contexts
$ twrk context clear ASK-2024-01-07-001
✓ Context ASK-2024-01-07-001 cleared

$ twrk context clear --inactive --before "7 days ago"
✓ Cleared 5 inactive contexts older than 7 days
```

## Task Generation & Correlation

### Using Existing Task System with Source Flags

```javascript
class IntentTaskGenerator {
  async generateTasks(intents, context) {
    // Create parent task for intent group
    const parentTask = await taskApi.create({
      name: `Intent: ${this.summarizeIntents(intents)}`,
      description: context.currentPrompt,
      source: context.type,              // 'ask' or 'agent'
      context_id: context.id,
      intent_group_id: this.generateGroupId(),
      metadata: {
        intent_count: intents.length,
        confidence: this.averageConfidence(intents)
      }
    });

    // Create subtasks for each intent
    const createdTasks = [];
    for (const intent of intents) {
      // Check for correlation with existing tasks
      const correlation = await this.findCorrelation(intent);
      
      if (correlation.found && correlation.confidence > 0.8) {
        // Ask user to confirm
        const confirmed = await this.confirmCorrelation(correlation);
        if (confirmed) {
          // Create as subtask of existing
          const task = await taskApi.create({
            name: intent.taskName,
            parent_id: correlation.taskId,
            source: context.type,
            context_id: context.id,
            correlation_id: correlation.taskId
          });
          createdTasks.push(task);
          continue;
        }
      }
      
      // Create as new subtask under parent
      const task = await taskApi.create({
        name: intent.taskName,
        description: intent.taskDesc,
        parent_id: parentTask.id,
        source: context.type,
        context_id: context.id,
        intent_group_id: parentTask.intent_group_id,
        priority: intent.taskContext.priority,
        tags: intent.taskContext.tags
      });
      createdTasks.push(task);
    }
    
    return { parentTask, subtasks: createdTasks };
  }
}

## Implementation Priority

Now that we have a clear, simple design, here's the recommended implementation order:

### Phase 1: Database & Core (Week 1)
1. Add context tables to schema
2. Implement ContextManager class
3. Handle project vs global detection
4. Create "general" default context

### Phase 2: CLI Integration (Week 1-2)
1. Add context display to ask/agent output
2. Implement --context flag
3. Add --quiet flag to suppress context display
4. Handle non-project prompt (use general context)

### Phase 3: Context Commands (Week 2)
1. Implement `twrk context` subcommands
2. List, new, use, rename, show commands
3. Clean command with confirmation

### Phase 4: Intent Loop Integration (Week 3)
1. Pass context history to LLM
2. Update ask command to use context
3. Update agent command to use context
4. Test context continuity

## Test Plan

### Unit Tests

```javascript
describe('ContextManager', () => {
  it('should create new context with auto-generated ID', async () => {
    const context = await manager.createContext('project-1', 'ask', 'test prompt');
    expect(context.id).toMatch(/^ASK-\d{4}-\d{2}-\d{2}-\d{3}$/);
  });

  it('should auto-expire contexts after 24 hours', async () => {
    const context = await manager.createContext('project-1', 'ask', 'test');
    expect(context.expires_at).toBe(/* 24 hours from now */);
  });

  it('should continue recent context within time window', async () => {
    const ctx1 = await manager.createContext('project-1', 'ask', 'first');
    const ctx2 = await manager.getOrCreateContext('project-1', 'ask', 'second');
    expect(ctx2.id).toBe(ctx1.id);
  });

  it('should create new context after time window', async () => {
    const ctx1 = await manager.createContext('project-1', 'ask', 'first');
    // Simulate 2 hour gap
    mockDate.advance(2 * 60 * 60 * 1000);
    const ctx2 = await manager.getOrCreateContext('project-1', 'ask', 'second');
    expect(ctx2.id).not.toBe(ctx1.id);
  });
});
```

### Integration Tests

```javascript
describe('Ask Command with Context', () => {
  it('should show context ID in response', async () => {
    const result = await runCommand('ask', 'implement auth');
    expect(result.output).toContain('[Context: ASK-');
  });

  it('should continue context with --continue flag', async () => {
    await runCommand('ask', 'implement auth');
    const result = await runCommand('ask', '--continue', 'use JWT');
    expect(result.output).toContain('Continuing our discussion');
  });

  it('should reference previous context', async () => {
    await runCommand('ask', 'implement auth with JWT');
    const result = await runCommand('ask', '--continue', 'add refresh tokens too');
    expect(result.output).toContain('JWT');  // Should remember JWT context
  });
});
```

### End-to-End Test Scenarios

1. **Context Continuity Test**
   ```bash
   $ twrk ask "implement user auth"
   $ twrk ask "use JWT"  # Should understand this refers to auth
   $ twrk ask "add refresh tokens"  # Should build on previous
   ```

2. **Context Isolation Test**
   ```bash
   $ twrk ask --new "implement auth"
   $ twrk ask --new "fix bug in payment"
   $ twrk ask "add validation"  # Should ask which context
   ```

3. **Context Recovery Test**
   ```bash
   $ twrk ask "complex task with many steps"
   # Kill process mid-execution
   $ twrk ask --continue "where were we?"
   # Should recover and continue
   ```

4. **Multi-User Context Test**
   - Ensure contexts are project-scoped
   - Test context isolation between projects
   - Verify no context leakage

### Performance Tests

1. **Context Lookup Performance**
   - Measure time to retrieve context with many turns
   - Ensure <100ms for typical usage

2. **Cleanup Performance**
   - Test cleanup with 1000+ expired contexts
   - Ensure doesn't block main operations

3. **Memory Usage**
   - Verify contexts are properly released
   - Check for memory leaks in long sessions

## Migration Guide

### For Existing Users
1. Contexts are opt-in - existing usage unchanged
2. First use creates .taskwerk/contexts.db automatically  
3. Old single-shot commands work exactly the same

### Configuration Options
```yaml
# .taskwerk/config.yml
conversation:
  auto_continue_window: 3600  # seconds (default: 1 hour)
  context_expiry: 86400       # seconds (default: 24 hours)
  show_context_id: true       # Show [Context: ID] in responses
  auto_create: true           # Auto-create contexts
  cleanup_interval: 3600      # Run cleanup every hour
```

## Security Considerations

1. **Context Isolation**
   - Contexts are project-scoped
   - No cross-project context access
   - Proper SQL injection prevention

2. **Privacy**
   - Contexts stored locally only
   - Option to disable context storage
   - Clear audit trail for compliance

3. **Data Retention**
   - Automatic expiry and cleanup
   - Manual purge commands
   - No sensitive data in contexts

## Final Design: Two-Tier Context System

### 1. Project Context
When in an initialized Taskwerk project:
- **Scope**: Project-specific
- **Storage**: `.taskwerk/contexts/`
- **Capabilities**: Full (ask mode for info, agent mode for actions)
- **Task Creation**: Yes
- **Lifespan**: Lives with project

### 2. Global Named Contexts
When outside a project:
- **Scope**: Global, accessible from anywhere
- **Storage**: `~/.taskwerk/global-contexts/{name}/`
- **Default**: "general" context (auto-created)
- **Capabilities**: Both ask and agent modes available
- **Tool Limitations**: No project-specific tools (no task creation/management)
- **Available Tools**: File operations, web search, general system tools
- **Lifespan**: Forever (manual cleanup)

### Context Management Commands

```bash
# Global context management
$ twrk context list                    # List contexts (project or global)
$ twrk context new <name>              # Create new global context
$ twrk context use <name>              # Switch to different global context
$ twrk context rename <old> <new>      # Rename a context
$ twrk context show <name>             # Show context details and history
$ twrk context clean --unused-days 90  # Cleanup tool (with confirmation)

# Using specific contexts
$ twrk ask --context python-tips "how do I parse JSON?"
$ twrk ask --context general "what time is it?"
$ twrk ask  # Uses default context based on location
```

### User Experience

#### In a Project:
```bash
$ cd ~/projects/webapp
$ twrk ask "how should I implement auth?"
╭─ [Project: webapp] Chat: implement-auth ─╮
│ For this project, I recommend JWT auth... │
│ Would you like me to create tasks? [Y/n]  │
╰───────────────────────────────────────────╯

$ twrk agent "implement the auth system"
╭─ [Project: webapp] Mode: agent ─╮
│ I'll implement the auth system... │
│ Creating tasks and files...       │
╰──────────────────────────────────╯
```

#### Outside a Project:
```bash
$ cd ~/documents
$ twrk ask "how do I parse JSON in Python?"
╭─ [Global: general] ─╮
│ To parse JSON in Python, use the json module... │
╰─────────────────────────────────────────────────╯

# Agent mode works too, with available tools
$ twrk agent "find all Python files in ~/projects"
╭─ [Global: general] Mode: agent ─╮
│ I'll search for Python files...  │
│ Using file search tools...       │
│                                  │
│ Found 47 .py files:              │
│ ~/projects/webapp/main.py        │
│ ~/projects/scripts/parse.py      │
│ ...                              │
╰──────────────────────────────────╯

# Can't create tasks without a project
$ twrk agent "create a task to review these files"
╭─ [Global: general] Mode: agent ─╮
│ Task creation requires a project.│
│ Would you like to:               │
│ 1. Initialize a project here     │
│ 2. Navigate to an existing project│
│ 3. Continue without tasks        │
╰──────────────────────────────────╯

# Create specialized context
$ twrk context new python-recipes
Created global context: python-recipes

$ twrk ask --context python-recipes "save this JSON parsing example"
╭─ [Global: python-recipes] ─╮
│ I'll save this JSON parsing example for you... │
╰────────────────────────────────────────────────╯

# List all global contexts
$ twrk context list
GLOBAL CONTEXTS:
  general          (default)   Used 5 min ago    23 conversations
  python-recipes   (active)    Used just now     1 conversation  
  go-patterns                  Used 2 days ago   8 conversations
  aws-notes                    Used 1 week ago   15 conversations
```

### Tool Availability by Context

#### Project Context Tools:
- **All Tools Available**: Full access to all registered tools
- **Task Management**: Create, update, list tasks
- **File Operations**: Read, write, search files
- **System Tools**: Execute commands, git operations
- **Web Tools**: Search, fetch URLs
- **MCP Tools**: If configured

#### Global Context Tools:
- **General Tools**: File operations, web search, calculations
- **No Project Tools**: Cannot create/manage tasks
- **Limited Scope**: Operations relative to current directory
- **Safety**: More restrictive permissions

```javascript
class ToolResolver {
  getAvailableTools(context, mode) {
    if (context.type === 'project') {
      return this.getAllTools();  // Everything available
    } else {
      // Global context - filter out project-specific tools
      return this.getTools().filter(tool => 
        !['create_task', 'update_task', 'list_tasks'].includes(tool.name)
      );
    }
  }
}
```

## Phase 1 Implementation Task List

### 1. Database Schema Implementation
- [ ] Create migration for chat_contexts table
- [ ] Create migration for chat_turns table
- [ ] Add source, context_id, intent_group_id, correlation_id columns to tasks table
- [ ] Create indexes for performance
- [ ] Write migration tests

### 2. Context Manager Core
- [ ] Implement ContextManager class
- [ ] Project vs global context detection
- [ ] Context creation with auto-naming
- [ ] Default "general" global context creation
- [ ] Context retrieval and continuation logic
- [ ] Turn management (add, retrieve history)
- [ ] Unit tests for all context operations

### 3. CLI Integration - Context Display
- [ ] Add context detection to ask command
- [ ] Add context detection to agent command
- [ ] Implement context header display
- [ ] Add --quiet flag to suppress context display
- [ ] Add --context flag for explicit context selection
- [ ] Add --new flag to force new context
- [ ] Update help text for ask/agent commands

### 4. Global Context Handling
- [ ] Detect when not in project directory
- [ ] Use global "general" context by default
- [ ] Show [Global: name] vs [Project: name] in UI
- [ ] Prevent task creation in global context
- [ ] Graceful prompts when project features needed

### 5. Context Management Commands
- [ ] Implement `twrk context` base command
- [ ] `context list` - Show contexts (project or global)
- [ ] `context new <name>` - Create named global context
- [ ] `context use <name>` - Switch global context
- [ ] `context show <name>` - Display context details
- [ ] `context rename <old> <new>` - Rename context
- [ ] `context clean` - Manual cleanup with confirmation
- [ ] Command tests and help documentation

### 6. Task Source Integration
- [ ] Update task creation to include source field
- [ ] Add context_id linking for chat-created tasks
- [ ] Implement intent grouping for multi-task creation
- [ ] Add correlation detection for existing tasks
- [ ] Update list command to show source
- [ ] Add --source filter to list command
- [ ] Update task display to show origin

### 7. Intent Loop Integration
- [ ] Pass conversation history to LLM calls
- [ ] Format context for LLM prompts
- [ ] Handle context references ("as we discussed")
- [ ] Test context continuity across turns
- [ ] Implement confidence-based context usage

### 8. Testing & Documentation
- [ ] Integration tests for context flow
- [ ] End-to-end test scenarios
- [ ] Performance tests for context retrieval
- [ ] Update user documentation
- [ ] Add context examples to help
- [ ] Migration guide for existing users

### 9. Edge Cases & Polish
- [ ] Handle context corruption gracefully
- [ ] Context size limits and truncation
- [ ] Concurrent access handling
- [ ] Cleanup orphaned contexts
- [ ] Progress indicators for long operations

## Estimated Timeline
- Week 1: Database schema & Context Manager (Tasks 1-2)
- Week 2: CLI Integration & Global contexts (Tasks 3-4)
- Week 3: Context commands & Task integration (Tasks 5-6)
- Week 4: Intent loop & Testing (Tasks 7-8)
- Week 5: Polish & edge cases (Task 9)

## Success Criteria
- [ ] Context persists between commands
- [ ] Clear UI showing active context
- [ ] Global contexts work without projects
- [ ] Task source tracking functional
- [ ] All tests passing
- [ ] No breaking changes to existing CLI

## Phase 2 Preview
For extended conversations and interactive mode, see [Chat Management Phase 2](./chat_management_phase2.md).

### Context Display

Always visible at top of response (unless --quiet):
```bash
$ twrk ask "what was that command?"
╭─ [Project: webapp] Chat: command-help ─╮
│ Based on our previous discussion...     │
╰─────────────────────────────────────────╯

$ twrk ask --quiet "what was that command?"
Based on our previous discussion...
```

## Future Enhancements

1. **Interactive Chat Mode** (Phase 2 Priority)
   - `twrk chat` for extended conversations
   - Slash commands for all CLI operations
   - Seamless mode switching
   - Rich terminal UI with syntax highlighting

2. **Context Templates**
   - Save common contexts as templates
   - Quick-start for repeated workflows

3. **Context Sharing**
   - Export/import contexts
   - Team collaboration features

4. **Smart Context Switching**
   - Auto-detect topic changes
   - Suggest context switches

5. **Context Analytics**
   - Track common patterns
   - Improve intent detection
   - Learn user preferences

## Example Chat Sessions with Task Updates

### Example 1: Simple Task Creation

```bash
# Turn 1
$ twrk ask "implement user authentication with email and password"
╭─ [Project: webapp] Chat: "implement-user-authentication" (new) ─╮
│ I'll help you implement user authentication. Let me create     │
│ tasks for this:                                                 │
│                                                                 │
│ Created parent task: TASK-045 (source: ask)                    │
│   └─ TASK-046: Create user model with email/password           │
│   └─ TASK-047: Add password hashing with bcrypt                │
│   └─ TASK-048: Create login endpoint                           │
│   └─ TASK-049: Create registration endpoint                    │
│   └─ TASK-050: Add session management                          │
│                                                                 │
│ All tasks created with source='ask' for easy filtering.        │
╰─────────────────────────────────────────────────────────────────╯

# Database changes:
- chat_contexts: New row with id='CHAT-001', name='implement-user-authentication'
- chat_turns: New turn with role='user', content='implement user authentication...'
- chat_turns: New turn with role='assistant', created_task_ids=['TASK-045','TASK-046',...]
- tasks: 6 new tasks with source='ask', context_id='CHAT-001'

# Turn 2 (continuing same session)
$ twrk ask "also add password reset functionality"
╭─ [Project: webapp] Chat: "implement-user-authentication" (continuing) ─╮
│ I'll add password reset to our authentication system:                  │
│                                                                        │
│ Created under TASK-045:                                                │
│   └─ TASK-051: Create password reset token model                      │
│   └─ TASK-052: Add forgot password endpoint                           │
│   └─ TASK-053: Create reset password endpoint                         │
│   └─ TASK-054: Send password reset emails                             │
╰────────────────────────────────────────────────────────────────────────╯

# Database changes:
- chat_turns: New turn added to same context
- tasks: 4 new tasks as children of TASK-045
```

### Example 2: Correlation with Existing Tasks

```bash
# Turn 1
$ twrk ask "fix the login bug where users get stuck on loading"
╭─ [Project: webapp] Chat: "fix-login-bug" (new) ─╮
│ I found an existing task that might be related:  │
│                                                   │
│ TASK-023: "Login timeout issue"                   │
│   Status: in-progress                             │
│   Assigned: @john                                 │
│                                                   │
│ Is this the bug you're referring to? [Y/n]       │
╰───────────────────────────────────────────────────╯
> Y

╭─ [Project: webapp] Chat: "fix-login-bug" (continuing) ─╮
│ I'll add subtasks to TASK-023 for fixing this:         │
│                                                         │
│ Created under TASK-023:                                 │
│   └─ TASK-055: Debug loading spinner state             │
│   └─ TASK-056: Add timeout handler for API calls       │
│   └─ TASK-057: Show error message on timeout           │
│                                                         │
│ These are linked to the existing bug (correlation_id). │
╰─────────────────────────────────────────────────────────╯

# Database changes:
- tasks: 3 new tasks with parent_id=23, correlation_id=23, source='ask'
```

### Example 3: Agent Mode with Task Updates

```bash
# Turn 1
$ twrk agent "implement the password reset feature we discussed"
╭─ [Project: webapp] Chat: "implement-password-reset" (new) ─╮
│ I'll implement the password reset feature. First, let me   │
│ check the existing tasks...                                 │
│                                                            │
│ Found TASK-051 through TASK-054 for password reset.       │
│ Starting implementation...                                  │
│                                                            │
│ ✓ TASK-051: Created password_reset_tokens table           │
│ ✓ TASK-052: Implemented /api/auth/forgot-password         │
│ ⚠ TASK-053: Partially complete - need email config        │
│ ⏸ TASK-054: Blocked - email service not configured        │
│                                                            │
│ Updated task statuses:                                     │
│   - TASK-051: done (source: agent)                        │
│   - TASK-052: done (source: agent)                        │
│   - TASK-053: in-progress                                 │
│   - TASK-054: blocked                                     │
╰────────────────────────────────────────────────────────────╯

# Database changes:
- tasks: Status updates for 4 tasks
- chat_turns: Tool calls recorded (create_file, update_task, etc.)
```

### Example 4: Global Context Usage

```bash
# Outside any project
$ cd ~
$ twrk ask "what's a good pattern for error handling in Go?"
╭─ [Global] Chat: "pattern-error-handling-go" (new) ─╮
│ Here are Go error handling best practices...        │
│                                                      │
│ No tasks created (global context, no project).      │
╰──────────────────────────────────────────────────────╯

# Later, in a Go project
$ cd ~/projects/my-go-app
$ twrk ask "implement the error handling pattern we discussed"
╭─ [Project: my-go-app] Chat: "implement-error-handling" (new) ─╮
│ I remember discussing Go error handling patterns.             │
│ Would you like me to:                                         │
│ 1. Reference the global context about Go patterns             │
│ 2. Start fresh in this project context                        │
│                                                                │
│ Choice [1]:                                                    │
╰────────────────────────────────────────────────────────────────╯
> 1

# Pulls information from global context to inform project-specific tasks
```

### Task Filtering Examples

```bash
# Show only CLI-created tasks (traditional usage)
$ twrk list --source cli
ID    NAME                STATUS      SOURCE
001   Update README       todo        cli
015   Fix config bug      in-progress cli

# Show only AI-generated tasks
$ twrk list --source ask,agent
ID    NAME                STATUS      SOURCE  CONTEXT
045   Intent: auth        done        ask     implement-user-auth
046   Create user model   done        ask     implement-user-auth
055   Debug loading       todo        ask     fix-login-bug

# Show tasks from specific chat
$ twrk list --context implement-user-auth
ID    NAME                STATUS      SOURCE
045   Intent: auth        done        ask
046   Create user model   done        ask
047   Add password hash   done        ask
...
```

This comprehensive plan ensures chat management enhances Taskwerk while maintaining its core CLI philosophy.