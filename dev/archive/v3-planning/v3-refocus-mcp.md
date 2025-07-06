# Taskwerk MCP (Model Context Protocol) Integration

## Overview

This document outlines the future MCP integration for taskwerk, ensuring our CLI design is robust enough to support both interfaces without major changes. MCP will provide a native, high-performance interface for AI agents to interact with taskwerk.

## Design Principles

1. **CLI First**: Everything must work perfectly via CLI
2. **No Breaking Changes**: MCP adds capabilities, doesn't change existing behavior
3. **Shared Core**: Both CLI and MCP use the same underlying API
4. **Progressive Enhancement**: MCP provides richer features when available

## Architecture

### Layered Design

```
┌─────────────────┐     ┌─────────────────┐
│   CLI Interface │     │  MCP Interface  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
             ┌───────▼────────┐
             │  Core API      │  <- Shared implementation
             │  (JavaScript)  │
             └───────┬────────┘
                     │
             ┌───────▼────────┐
             │  SQLite DB     │
             └────────────────┘
```

### Core API Requirements

To support both CLI and MCP, our core API must:

1. **Return Structured Data**: Not just formatted strings
2. **Support Streaming**: For long operations
3. **Provide Metadata**: Operation status, affected resources
4. **Handle Partial Updates**: For real-time feedback

## MCP Tool Mappings

### Task Operations

| CLI Command | MCP Tool | Notes |
|------------|----------|-------|
| `twrk task add "name"` | `task_create` | Returns full task object |
| `twrk task list` | `task_list` | Supports pagination |
| `twrk task show TASK-001` | `task_get` | Includes related data |
| `twrk task update TASK-001` | `task_update` | Partial updates supported |
| `twrk task delete TASK-001` | `task_delete` | Soft delete by default |

### Query Operations

| CLI Command | MCP Tool | Notes |
|------------|----------|-------|
| `twrk "what's blocked?"` | `task_query_natural` | Natural language |
| `twrk task list --status active` | `task_query_structured` | Structured filters |
| `twrk logs search "error"` | `log_search` | Full-text search |

### Git Operations

| CLI Command | MCP Tool | Notes |
|------------|----------|-------|
| `twrk git branch TASK-001` | `git_create_branch` | Returns branch name |
| `twrk git commit TASK-001` | `git_commit_with_context` | Includes task context |

## MCP-Specific Features

### 1. Resources (Persistent Context)

MCP can provide persistent context that CLI cannot:

```javascript
// Resources available to AI
{
  "taskwerk://context/rules": "Project rules and guidelines",
  "taskwerk://tasks/active": "Currently active tasks",
  "taskwerk://tasks/blocked": "Blocked tasks needing attention",
  "taskwerk://dependencies/graph": "Task dependency visualization",
  "taskwerk://stats/summary": "Project statistics"
}
```

### 2. Subscriptions (Real-time Updates)

```javascript
// AI can subscribe to changes
{
  "taskwerk://events/task-updates": "Task state changes",
  "taskwerk://events/blockers": "New blockers",
  "taskwerk://events/completions": "Task completions"
}
```

### 3. Batch Operations

```javascript
// MCP can batch operations efficiently
{
  "tool": "task_batch_update",
  "arguments": {
    "updates": [
      { "taskId": "TASK-001", "status": "completed" },
      { "taskId": "TASK-002", "status": "active" },
      { "taskId": "TASK-003", "assignee": "ai" }
    ]
  }
}
```

## Implementation Plan

### Phase 1: CLI Foundation (Current)

Ensure CLI commands:
- ✅ Return structured data internally
- ✅ Support JSON output format (`--format json`)
- ✅ Have consistent error codes
- ✅ Log all operations

### Phase 2: API Extraction

Create `taskwerk-api` package:
```javascript
// taskwerk-api/index.js
export class TaskwerkAPI {
  async createTask(data) { /* returns Task object */ }
  async updateTask(id, updates) { /* returns Task object */ }
  async queryTasks(filters) { /* returns Task[] */ }
  async executeNaturalQuery(query) { /* returns QueryResult */ }
}
```

### Phase 3: MCP Server

Create `taskwerk-mcp` package:
- Wraps TaskwerkAPI
- Provides tool definitions
- Handles resource management
- Manages subscriptions

## CLI Design Validations

### Commands That Map Well to MCP

✅ **Good Design**:
```bash
twrk task add "Fix bug" --priority high
# Maps to: task_create({ name: "Fix bug", priority: "high" })

twrk task update TASK-001 --status active --note "Started"
# Maps to: task_update({ id: "TASK-001", status: "active", note: "Started" })
```

### Potential Issues Found

❌ **Issue: Ambiguous Natural Language**
```bash
twrk "complete TASK-001 and create a new task for testing"
```
**Problem**: Multiple operations in one command
**Solution**: MCP will break this into separate tool calls

❌ **Issue: Implicit Context**
```bash
twrk task list  # What's the default filter?
```
**Solution**: MCP tool will have explicit defaults in schema

❌ **Issue: Side Effects**
```bash
twrk git commit TASK-001  # Also updates task status?
```
**Solution**: MCP will return all affected resources

## MCP Tool Schemas

### task_create

```json
{
  "name": "task_create",
  "description": "Create a new task with automatic ID assignment",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Task name/title",
        "minLength": 1,
        "maxLength": 200
      },
      "description": {
        "type": "string",
        "description": "Detailed description (markdown)"
      },
      "priority": {
        "type": "string",
        "enum": ["high", "medium", "low"],
        "default": "medium"
      },
      "assignee": {
        "type": "string",
        "description": "Username or 'ai'"
      },
      "parentId": {
        "type": "string",
        "pattern": "^TASK-\\d{3,}$"
      },
      "dependsOn": {
        "type": "array",
        "items": {
          "type": "string",
          "pattern": "^TASK-\\d{3,}$"
        }
      },
      "tags": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "required": ["name"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "task": { "$ref": "#/definitions/Task" },
      "warnings": {
        "type": "array",
        "items": { "type": "string" }
      }
    }
  }
}
```

### task_query_natural

```json
{
  "name": "task_query_natural",
  "description": "Query tasks using natural language",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language query",
        "examples": [
          "what tasks are blocked?",
          "show me high priority tasks assigned to john",
          "tasks created this week"
        ]
      },
      "limit": {
        "type": "integer",
        "default": 50,
        "minimum": 1,
        "maximum": 1000
      }
    },
    "required": ["query"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "tasks": {
        "type": "array",
        "items": { "$ref": "#/definitions/Task" }
      },
      "interpretation": {
        "type": "string",
        "description": "How the query was interpreted"
      },
      "total": { "type": "integer" },
      "limit": { "type": "integer" }
    }
  }
}
```

### task_analyze

```json
{
  "name": "task_analyze",
  "description": "Analyze tasks and provide insights",
  "inputSchema": {
    "type": "object",
    "properties": {
      "analysis": {
        "type": "string",
        "enum": [
          "blockers",
          "critical_path",
          "workload",
          "progress",
          "risks"
        ]
      },
      "scope": {
        "type": "object",
        "properties": {
          "assignee": { "type": "string" },
          "sprint": { "type": "string" },
          "category": { "type": "string" }
        }
      }
    },
    "required": ["analysis"]
  }
}
```

## Resource Definitions

### Active Tasks Resource

```javascript
{
  uri: "taskwerk://tasks/active",
  name: "Active Tasks",
  description: "All currently active tasks with full context",
  mimeType: "application/json",
  // Refreshed every 30 seconds
  ttl: 30000,
  // Example content
  content: {
    tasks: [
      {
        id: "TASK-042",
        name: "Fix login timeout",
        status: "active",
        assignee: "john",
        notes: "Found issue in session middleware...",
        blockers: [],
        subtasks: ["TASK-043", "TASK-044"]
      }
    ],
    summary: {
      total: 3,
      byAssignee: { john: 2, jane: 1 },
      averageAge: "2.5 days"
    }
  }
}
```

### Project Rules Resource

```javascript
{
  uri: "taskwerk://context/rules",
  name: "Project Rules",
  description: "taskwerk_rules.md content for AI guidance",
  mimeType: "text/markdown",
  // Cached for 1 hour
  ttl: 3600000
}
```

## Error Handling

### CLI Errors
```bash
$ twrk task update INVALID-ID --status active
Error: Task not found: INVALID-ID
```

### MCP Errors
```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task not found",
    "details": {
      "taskId": "INVALID-ID",
      "suggestion": "Use 'task_list' to see available tasks"
    }
  }
}
```

## Security Considerations

### Authentication
- MCP server reads same config as CLI
- Can implement token-based auth for remote MCP
- Respects same user permissions

### Audit Trail
- All MCP operations logged with `source: "mcp"`
- Includes MCP client identifier
- Same audit rules as CLI

### Rate Limiting
```javascript
{
  "rateLimits": {
    "task_create": "100/hour",
    "task_query_natural": "1000/hour",
    "log_search": "100/hour"
  }
}
```

## Testing Strategy

### 1. Parallel Testing
Every operation should work identically:
```bash
# CLI
twrk task add "Test task" --priority high

# MCP equivalent
mcp.call("task_create", { name: "Test task", priority: "high" })

# Both should produce same database state
```

### 2. Round-trip Testing
```javascript
// Create via CLI, query via MCP
const task = await mcp.call("task_get", { id: "TASK-001" });
assert(task.name === "Test task");
```

### 3. Stress Testing
- MCP can handle 1000s of requests/second
- CLI typically handles 10s of requests/second
- Same database locks and constraints

## Migration Path

### For Users
1. Continue using CLI as normal
2. Install MCP server when ready: `npm install -g taskwerk-mcp`
3. Configure AI assistant to use MCP
4. CLI and MCP can be used simultaneously

### For Developers
1. Refactor CLI to use shared API (no user impact)
2. Build MCP server on top of API
3. Add MCP-specific features gradually
4. Maintain CLI as first-class interface

## Future Possibilities

### 1. Collaborative Editing
Multiple AI agents working on same project via MCP

### 2. Intelligent Caching
MCP server maintains smart cache of common queries

### 3. Predictive Features
MCP can pre-fetch likely next operations

### 4. Custom Tools
Projects can define custom MCP tools in `.taskwerk/mcp-tools/`

## Conclusion

Our CLI design is robust enough for MCP because:

1. **Structured Commands**: Clear mapping to function calls
2. **Consistent Patterns**: Predictable argument structure  
3. **JSON Support**: Already can output structured data
4. **Comprehensive Logging**: Full operation history
5. **Natural Language**: Already supports AI-friendly interface

The only adjustments needed:
- Ensure all operations return structured data internally
- Add operation metadata (affected resources, warnings)
- Document side effects clearly
- Keep commands atomic (one operation per command)

This positions taskwerk to be the premier task management tool for both human developers and AI agents.