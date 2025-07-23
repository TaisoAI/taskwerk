# Intent Loop Architecture

## Overview
The intent loop is a powerful feature that transforms messy, multi-faceted user prompts into structured, actionable tasks. It acts as an intelligent parser that understands context, extracts multiple intents, identifies dependencies, and creates a clean execution plan.

## Problem Statement
User prompts are often:
- **Messy**: "I need to fix the login bug and also add that new feature we talked about, oh and update the docs"
- **Multi-faceted**: Contains multiple unrelated asks in a single prompt
- **Implicit**: "Make it faster" (what is "it"? faster how?)
- **Context-dependent**: "Like we did last time but for the new module"
- **Ambiguous**: "Set up the thing with the API" (which API? what setup?)

## Intent Loop Flow

```
User Prompt → Intent Extraction → Task Decomposition → Dependency Analysis → JSON Structure → Execution Plan
```

## Task JSON Structure

```typescript
interface ExtractedTask {
  taskName: string;        // Inferred short name
  taskDesc: string;        // Detailed description
  taskType: TaskType;      // 'bug' | 'feature' | 'refactor' | 'docs' | 'research' | 'config'
  taskDependencies: string[]; // References to other task names
  taskBlockers: string[];     // External blockers or prerequisites
  taskContext: {
    files: string[];       // Relevant files mentioned or inferred
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimatedComplexity: 'trivial' | 'small' | 'medium' | 'large';
    suggestedAssignee?: string;
    tags: string[];
  };
  taskActions: {
    verb: string;         // Primary action: create, fix, update, research, etc.
    target: string;       // What to act on
    details: string[];    // Specific steps or requirements
  };
  confidence: number;     // 0-1, how confident the extraction is
}
```

## Examples

### Example 1: Messy Multi-Intent Prompt

**User Input:**
```
"I need to fix the login bug where users get stuck on the loading screen, 
and also implement the forgot password feature. The API team said the 
new endpoints will be ready tomorrow. Oh and can you update the README 
with the new setup instructions? The current ones are outdated since we 
switched to Docker."
```

**Extracted Tasks:**
```json
[
  {
    "taskName": "Fix login loading bug",
    "taskDesc": "Fix the issue where users get stuck on the loading screen during login",
    "taskType": "bug",
    "taskDependencies": [],
    "taskBlockers": [],
    "taskContext": {
      "files": ["src/components/Login.js", "src/api/auth.js"],
      "priority": "high",
      "estimatedComplexity": "small",
      "tags": ["bug", "auth", "ui"]
    },
    "taskActions": {
      "verb": "fix",
      "target": "login loading screen",
      "details": [
        "Investigate why loading screen persists",
        "Check API response handling",
        "Add timeout handling",
        "Test with slow network conditions"
      ]
    },
    "confidence": 0.95
  },
  {
    "taskName": "Implement forgot password",
    "taskDesc": "Add forgot password feature using new API endpoints",
    "taskType": "feature",
    "taskDependencies": [],
    "taskBlockers": ["API endpoints not ready until tomorrow"],
    "taskContext": {
      "files": ["src/components/ForgotPassword.js", "src/api/auth.js"],
      "priority": "medium",
      "estimatedComplexity": "medium",
      "suggestedAssignee": "@frontend-team",
      "tags": ["feature", "auth"]
    },
    "taskActions": {
      "verb": "implement",
      "target": "forgot password feature",
      "details": [
        "Create forgot password UI component",
        "Integrate with password reset API endpoint",
        "Add email validation",
        "Handle success/error states",
        "Add to routing"
      ]
    },
    "confidence": 0.90
  },
  {
    "taskName": "Update README Docker setup",
    "taskDesc": "Update README with new Docker-based setup instructions",
    "taskType": "docs",
    "taskDependencies": [],
    "taskBlockers": [],
    "taskContext": {
      "files": ["README.md", "docker-compose.yml"],
      "priority": "low",
      "estimatedComplexity": "trivial",
      "tags": ["documentation", "docker", "setup"]
    },
    "taskActions": {
      "verb": "update",
      "target": "README setup section",
      "details": [
        "Remove outdated non-Docker instructions",
        "Add Docker prerequisites",
        "Document docker-compose commands",
        "Include troubleshooting section"
      ]
    },
    "confidence": 0.98
  }
]
```

### Example 2: Implicit Context

**User Input:**
```
"The performance is terrible on the dashboard, especially when switching 
between tabs. Also need to add caching like we did for the user profile. 
And make sure it works on mobile this time."
```

**Extracted Tasks:**
```json
[
  {
    "taskName": "Optimize dashboard performance",
    "taskDesc": "Improve performance issues on dashboard, particularly tab switching",
    "taskType": "refactor",
    "taskDependencies": [],
    "taskBlockers": [],
    "taskContext": {
      "files": ["src/pages/Dashboard.js", "src/components/TabPanel.js"],
      "priority": "high",
      "estimatedComplexity": "medium",
      "tags": ["performance", "optimization", "dashboard"]
    },
    "taskActions": {
      "verb": "optimize",
      "target": "dashboard tab switching",
      "details": [
        "Profile current performance bottlenecks",
        "Implement lazy loading for tab content",
        "Add React.memo to prevent unnecessary re-renders",
        "Optimize data fetching strategy"
      ]
    },
    "confidence": 0.88
  },
  {
    "taskName": "Add dashboard caching",
    "taskDesc": "Implement caching mechanism similar to user profile implementation",
    "taskType": "feature",
    "taskDependencies": ["Optimize dashboard performance"],
    "taskBlockers": [],
    "taskContext": {
      "files": ["src/utils/cache.js", "src/pages/Dashboard.js"],
      "priority": "medium",
      "estimatedComplexity": "small",
      "tags": ["caching", "performance", "dashboard"]
    },
    "taskActions": {
      "verb": "implement",
      "target": "dashboard caching layer",
      "details": [
        "Review user profile caching implementation",
        "Adapt caching strategy for dashboard data",
        "Set appropriate cache TTL",
        "Add cache invalidation logic"
      ]
    },
    "confidence": 0.85
  },
  {
    "taskName": "Fix dashboard mobile responsiveness",
    "taskDesc": "Ensure dashboard works properly on mobile devices",
    "taskType": "bug",
    "taskDependencies": ["Optimize dashboard performance"],
    "taskBlockers": [],
    "taskContext": {
      "files": ["src/styles/Dashboard.css", "src/components/ResponsiveLayout.js"],
      "priority": "medium",
      "estimatedComplexity": "small",
      "tags": ["mobile", "responsive", "ui", "dashboard"]
    },
    "taskActions": {
      "verb": "fix",
      "target": "mobile responsiveness",
      "details": [
        "Test on various mobile devices",
        "Fix layout issues on small screens",
        "Ensure touch interactions work properly",
        "Optimize for mobile performance"
      ]
    },
    "confidence": 0.92
  }
]
```

### Example 3: Complex Dependencies

**User Input:**
```
"We need to migrate from REST to GraphQL. Start with the user service, 
but first check if the new auth system supports it. Once that's done, 
update the frontend to use the new queries. The mobile team needs this 
by end of month for their release."
```

**Extracted Tasks:**
```json
[
  {
    "taskName": "Research auth GraphQL support",
    "taskDesc": "Investigate if the new authentication system supports GraphQL",
    "taskType": "research",
    "taskDependencies": [],
    "taskBlockers": [],
    "taskContext": {
      "files": ["src/auth/config.js", "docs/auth-system.md"],
      "priority": "high",
      "estimatedComplexity": "small",
      "tags": ["research", "auth", "graphql"]
    },
    "taskActions": {
      "verb": "research",
      "target": "auth system GraphQL compatibility",
      "details": [
        "Review auth system documentation",
        "Check for GraphQL middleware support",
        "Test authentication with GraphQL queries",
        "Document findings and recommendations"
      ]
    },
    "confidence": 0.93
  },
  {
    "taskName": "Migrate user service to GraphQL",
    "taskDesc": "Convert user service from REST API to GraphQL",
    "taskType": "refactor",
    "taskDependencies": ["Research auth GraphQL support"],
    "taskBlockers": [],
    "taskContext": {
      "files": ["src/api/users/*", "src/graphql/schema.js"],
      "priority": "high",
      "estimatedComplexity": "large",
      "tags": ["migration", "graphql", "api", "backend"]
    },
    "taskActions": {
      "verb": "migrate",
      "target": "user service endpoints",
      "details": [
        "Define GraphQL schema for user types",
        "Implement resolvers for user queries",
        "Add mutations for user operations",
        "Maintain backward compatibility",
        "Add comprehensive tests"
      ]
    },
    "confidence": 0.87
  },
  {
    "taskName": "Update frontend GraphQL queries",
    "taskDesc": "Update frontend to use new GraphQL queries instead of REST calls",
    "taskType": "refactor",
    "taskDependencies": ["Migrate user service to GraphQL"],
    "taskBlockers": [],
    "taskContext": {
      "files": ["src/api/client.js", "src/queries/users.js"],
      "priority": "high",
      "estimatedComplexity": "medium",
      "suggestedAssignee": "@frontend-team",
      "tags": ["frontend", "graphql", "refactor"]
    },
    "taskActions": {
      "verb": "update",
      "target": "frontend API calls",
      "details": [
        "Replace REST calls with GraphQL queries",
        "Update data fetching logic",
        "Implement proper error handling",
        "Update loading states",
        "Test all user workflows"
      ]
    },
    "confidence": 0.91
  },
  {
    "taskName": "Coordinate mobile team release",
    "taskDesc": "Ensure GraphQL migration is ready for mobile team's end-of-month release",
    "taskType": "config",
    "taskDependencies": ["Update frontend GraphQL queries"],
    "taskBlockers": ["Mobile team release schedule"],
    "taskContext": {
      "files": [],
      "priority": "critical",
      "estimatedComplexity": "trivial",
      "suggestedAssignee": "@project-manager",
      "tags": ["coordination", "mobile", "release", "deadline"]
    },
    "taskActions": {
      "verb": "coordinate",
      "target": "mobile team integration",
      "details": [
        "Share GraphQL endpoint documentation",
        "Provide example queries",
        "Schedule integration testing",
        "Ensure API stability before deadline"
      ]
    },
    "confidence": 0.82
  }
]
```

## Intent Extraction Process

### 1. Initial Parse
```javascript
class IntentParser {
  async parseUserInput(input) {
    // First, identify sentence boundaries and separate concerns
    const segments = this.segmentInput(input);
    
    // Extract action verbs and their objects
    const actions = segments.map(s => this.extractAction(s));
    
    // Identify relationships between segments
    const relationships = this.findRelationships(segments);
    
    return { segments, actions, relationships };
  }
}
```

### 2. Context Enhancement
```javascript
class ContextEnhancer {
  async enhance(parsedInput, workspaceContext) {
    // Add file context based on mentioned components
    const filesContext = await this.inferRelevantFiles(parsedInput);
    
    // Add historical context (similar past tasks)
    const historicalContext = await this.findSimilarTasks(parsedInput);
    
    // Add domain knowledge (project-specific terms)
    const domainContext = await this.applyDomainKnowledge(parsedInput);
    
    return { ...parsedInput, filesContext, historicalContext, domainContext };
  }
}
```

### 3. Task Construction
```javascript
class TaskConstructor {
  async constructTasks(enhancedInput) {
    const tasks = [];
    
    for (const action of enhancedInput.actions) {
      const task = {
        taskName: this.generateTaskName(action),
        taskDesc: this.generateDescription(action, enhancedInput.context),
        taskType: this.classifyTaskType(action),
        taskDependencies: this.identifyDependencies(action, enhancedInput.relationships),
        taskBlockers: this.identifyBlockers(action, enhancedInput.segments),
        taskContext: this.buildContext(action, enhancedInput),
        taskActions: this.decomposeActions(action),
        confidence: this.calculateConfidence(action, enhancedInput)
      };
      
      tasks.push(task);
    }
    
    return this.optimizeDependencyGraph(tasks);
  }
}
```

### 4. LLM Prompt for Extraction
```typescript
const INTENT_EXTRACTION_PROMPT = `
You are an expert at understanding user intent and extracting structured tasks from natural language.

Given a user's request, extract all distinct tasks and return them as a JSON array with this structure:
{
  taskName: string (short, action-oriented name),
  taskDesc: string (detailed description),
  taskType: "bug" | "feature" | "refactor" | "docs" | "research" | "config",
  taskDependencies: string[] (references to other taskNames that must complete first),
  taskBlockers: string[] (external dependencies or prerequisites),
  taskContext: {
    files: string[] (likely files/components involved),
    priority: "low" | "medium" | "high" | "critical",
    estimatedComplexity: "trivial" | "small" | "medium" | "large",
    suggestedAssignee?: string (if mentioned or implied),
    tags: string[]
  },
  taskActions: {
    verb: string (primary action),
    target: string (what to act on),
    details: string[] (specific steps)
  },
  confidence: number (0-1)
}

Rules:
1. Each distinct action should be a separate task
2. Infer dependencies from temporal words (first, then, after, once)
3. Identify external blockers from phrases like "waiting for", "blocked by"
4. Estimate complexity based on scope of work described
5. Set priority based on urgency words and business impact
6. Use confidence to indicate ambiguity in the request

User Input: {input}

Current Context:
- Working Directory: {cwd}
- Existing Tasks: {existingTasks}
- Recent Activity: {recentActivity}

Extract all tasks as a JSON array:
`;
```

## Validation and Refinement

### 1. Dependency Validation
```javascript
class DependencyValidator {
  validate(tasks) {
    // Check for circular dependencies
    const cycles = this.detectCycles(tasks);
    if (cycles.length > 0) {
      throw new Error(`Circular dependencies detected: ${cycles}`);
    }
    
    // Ensure all referenced dependencies exist
    const allTaskNames = tasks.map(t => t.taskName);
    for (const task of tasks) {
      for (const dep of task.taskDependencies) {
        if (!allTaskNames.includes(dep)) {
          task.taskDependencies = task.taskDependencies.filter(d => d !== dep);
          task.taskBlockers.push(`Missing dependency: ${dep}`);
        }
      }
    }
    
    return tasks;
  }
}
```

### 2. User Confirmation
```javascript
class IntentConfirmation {
  async confirmWithUser(tasks) {
    console.log('\n📋 I understood your request as the following tasks:\n');
    
    for (const [idx, task] of tasks.entries()) {
      console.log(`${idx + 1}. ${task.taskName} (${task.taskType})`);
      console.log(`   ${task.taskDesc}`);
      if (task.taskDependencies.length > 0) {
        console.log(`   Depends on: ${task.taskDependencies.join(', ')}`);
      }
      if (task.taskBlockers.length > 0) {
        console.log(`   Blocked by: ${task.taskBlockers.join(', ')}`);
      }
      console.log(`   Priority: ${task.taskContext.priority}, Complexity: ${task.taskContext.estimatedComplexity}`);
      console.log('');
    }
    
    const response = await prompt('Is this correct? (yes/no/edit): ');
    
    if (response === 'edit') {
      return this.editTasks(tasks);
    }
    
    return response === 'yes' ? tasks : null;
  }
}
```

## Benefits

1. **Handles Messy Input**: Turns stream-of-consciousness into structured tasks
2. **Captures Relationships**: Automatically identifies dependencies and blockers
3. **Adds Context**: Enriches tasks with files, priority, and complexity
4. **Enables Planning**: Creates actionable plans from vague requests
5. **Improves Over Time**: Can learn from corrections and patterns

## Workflow Comparison: Claude vs Taskwerk Intent Loop

### Similarities
1. **Intent Analysis**: Both parse messy prompts into structured understanding
2. **Task Decomposition**: Break complex requests into actionable steps
3. **Dependency Recognition**: Identify relationships between tasks
4. **Context Enhancement**: Add relevant files, history, and domain knowledge
5. **User Confirmation**: Present plan before execution

### Key Differences

| Aspect | Claude's Workflow | Taskwerk Intent Loop |
|--------|------------------|---------------------|
| **Execution Model** | Direct execution with tools | Orchestration via MCP servers |
| **State Management** | In-memory conversation | Persistent DB storage per project |
| **Tool Access** | Built-in tools only | Extensible MCP servers + local tools |
| **Rollback** | Limited to current session | Full rollback with git integration |
| **Quality Gates** | None | Tests, linting, security scans |
| **Task Tracking** | Ephemeral | Persistent tasks in SQLite |
| **Collaboration** | Single user | Team-based with assignees |

### Claude's Workflow Example
```
User: "Fix the login bug and update docs"
→ Parse intent
→ Create in-memory task list
→ Execute directly with tools
→ Report results
```

### Taskwerk's Intent Loop Workflow
```
User: "Fix the login bug and update docs"
→ Parse intent
→ Create persistent tasks in DB
→ Orchestrate MCP servers for execution
→ Run quality gates (tests, lint)
→ Update task status
→ Maintain conversation history
```

## Conversational History Design

### Design Decision: Chat Mode vs Single-Shot with Memory

The user has raised a critical UX question about how Taskwerk should handle conversational context while maintaining its command-line nature.

### Option 1: Single-Shot Commands with Database Memory

```bash
# First command
$ twrk ask "I need to implement user auth"
→ Creates context in DB, returns response

# Follow-up command (remembers context)
$ twrk ask "use JWT tokens"
→ Retrieves context, understands this relates to auth
```

**Pros:**
- Maintains pipeable, scriptable nature
- Transparent to users (works like magic)
- No mode switching required
- Each command has clear start/end

**Cons:**
- User might not expect context retention
- Harder to "reset" conversation
- Context boundaries unclear

### Option 2: Explicit Chat Mode

```bash
# Enter chat mode
$ twrk ask --chat "I need to implement user auth"
> Taskwerk Chat (type 'exit' to quit)
> 
> I'll help you implement user auth. What type?
> JWT tokens
> Good choice. Here's the plan...
> exit

# Or inline
$ twrk agent --chat "implement the auth system we discussed"
```

**Pros:**
- Clear mode boundaries
- User expects conversational behavior
- Easy to implement context reset
- Familiar chat UX

**Cons:**
- Breaks single-shot paradigm
- Not pipeable in chat mode
- Requires explicit flag

### Option 3: Hybrid Approach (Recommended)

```bash
# Single-shot with context reference
$ twrk ask "implement user auth" --save-context auth-work
$ twrk ask "use JWT" --context auth-work

# Auto-context with project scope
$ twrk ask "implement user auth"  # Creates context: ASK-2024-01-07-001
$ twrk ask --continue "use JWT"   # Continues last context

# List contexts
$ twrk context list
ASK-2024-01-07-001: "implement user auth" (2 messages)
ASK-2024-01-07-002: "fix login bug" (5 messages)

# Clear context
$ twrk context clear ASK-2024-01-07-001
```

### Database Schema for Conversation History

```sql
-- Conversation contexts
CREATE TABLE conversation_contexts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'ask' or 'agent'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  title TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'abandoned'
  metadata JSON
);

-- Conversation turns
CREATE TABLE conversation_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  tool_calls JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (context_id) REFERENCES conversation_contexts(id)
);

-- Link tasks to conversations
CREATE TABLE conversation_tasks (
  context_id TEXT NOT NULL,
  task_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (context_id, task_id),
  FOREIGN KEY (context_id) REFERENCES conversation_contexts(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

### Implementation Recommendations

1. **Start with Option 3 (Hybrid)**
   - Default: Single-shot with auto-context
   - `--continue` flag for explicit continuation
   - `--new` flag to force new context
   - Context auto-expires after 24 hours of inactivity

2. **Context Behavior**
   - Each project has its own context namespace
   - Context includes: messages, created tasks, file edits
   - Show context indicator in responses:
     ```
     $ twrk ask "implement auth"
     [Context: ASK-2024-01-07-001] I'll help you implement authentication...
     ```

3. **Future Enhancement**
   - Add `--chat` mode later if users request it
   - Could support both modes simultaneously
   - Chat mode could use same DB schema

## Future Enhancements

1. **Learning System**: Remember user preferences and naming conventions
2. **Template Matching**: Recognize common patterns (e.g., "standard bug fix")
3. **Integration Awareness**: Understand external system dependencies
4. **Time Estimation**: Learn from historical data to improve estimates
5. **Multi-turn Refinement**: Allow conversational task definition
6. **Context Sharing**: Share conversation contexts between team members
7. **Context Templates**: Save common workflows as reusable templates

The intent loop transforms Taskwerk from a task management tool into an intelligent assistant that truly understands what users want to accomplish, while maintaining its command-line first philosophy.