[![npm version](https://img.shields.io/npm/v/taskwerk.svg)](https://www.npmjs.com/package/taskwerk)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

████████╗ █████╗ ███████╗██╗  ██╗██╗    ██╗███████╗██████╗ ██╗  ██╗
╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝██║    ██║██╔════╝██╔══██╗██║ ██╔╝
   ██║   ███████║███████╗█████╔╝ ██║ █╗ ██║█████╗  ██████╔╝█████╔╝ 
   ██║   ██╔══██║╚════██║██╔═██╗ ██║███╗██║██╔══╝  ██╔══██╗██╔═██╗ 
   ██║   ██║  ██║███████║██║  ██╗╚███╔███╔╝███████╗██║  ██║██║  ██╗
   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝


A lightweight CLI task manager optimized for human-AI collaboration workflows. 

## Taskwerk Overview

Taskwerk is a lightweight task tracker that can be used in side of software repos to break up and track trasks and is focused on agentic coding.  It includes task creation, git integration, and agentic-llm support to help get code written quickly and accurately without creating large numbers of subtasks that would as would be in a traditional issue tracking system.

- **Structured yet Human-Readable**: YAML frontmatter for metadata, markdown for content
- **Advanced Task Management**: Dependencies, subtasks, timeline tracking, and assignees
- **Git-Integrated**: Intelligent commit messages and branch management
- **Zero Vendor Lock-In**: Plain text files that work without the CLI
- **AI-Optimized**: Built for human-AI collaboration workflows
- **Backward Compatible**: Automatically migrates older task formats

## Quick Start

```bash
# Initialize Taskwerk in your project
npx taskwerk init

# Add your first task with enhanced metadata
npx taskwerk add "Fix login validation bug" --priority high --category bugs --assignee @john

# Start working on it
npx taskwerk start TASK-001

# Complete when done
npx taskwerk complete TASK-001 --note "Fixed session timeout issue"
```

That's it! Taskwerk creates structured YAML frontmatter files with markdown content for powerful task tracking.

## Installation

### No Installation Required
```bash
npx taskwerk init          # Use directly with npx
```

### Global Installation
```bash
npm install -g taskwerk  
taskwerk --help
```

### Project Integration
```bash
# Add to package.json scripts
{
  "scripts": {
    "task": "npx taskwerk"
  }
}

npm run task list
```

## Core Workflow

### 1. Enhanced Task Management
```bash
# Add tasks with rich metadata
taskwerk add "Fix authentication bug" --priority high --category bugs --assignee @alice
taskwerk add "Implement user dashboard" --category features --estimated 4h

# View and filter tasks
taskwerk list                    # All active tasks
taskwerk list --priority high   # Filter by priority
taskwerk list --assignee @alice # Filter by assignee
taskwerk status                  # Current session info

# Work with tasks
taskwerk start TASK-001          # Begin work (validates dependencies)
taskwerk complete TASK-001       # Mark done with timeline tracking
taskwerk pause TASK-001          # Pause work temporarily
taskwerk block TASK-001 --reason "Waiting for API docs"
taskwerk search "auth"           # Search across all task fields
```

### 2. Dependencies & Subtasks
```bash
# Manage task dependencies
taskwerk add-dependency TASK-002 TASK-001  # TASK-002 depends on TASK-001
taskwerk ready-tasks                       # Show tasks ready to work on

# Work with subtasks
taskwerk add-subtask TASK-001 "Write unit tests"
taskwerk add-subtask TASK-001 "Update documentation"
taskwerk list-subtasks TASK-001           # Show all subtasks
```

### 3. Git Integration (Optional)
```bash
# Create feature branch for task
taskwerk branch TASK-001         # Creates: feature/task-001-fix-auth-bug

# Make your code changes...
git add src/auth.js

# Generate intelligent commit message from completed tasks
taskwerk commit                  # Shows preview with task context
taskwerk commit --auto          # Actually commits with Co-Authored-By tags
```

### 4. Advanced Progress Tracking
```bash
taskwerk stats                   # Enhanced project overview with v2 metrics
taskwerk recent                  # Recently completed with timeline details
taskwerk context TASK-001       # Complete task details and dependency tree
taskwerk timeline TASK-001      # Show full task timeline
```

## File Structure

taskwerk creates these files in your project:

```
tasks/
├── tasks.md              # Active tasks (hand-editable)
├── tasks_completed.md    # Completed tasks archive
├── tasks-how-to.md       # Quick reference
└── taskwerk-rules.md     # Project workflow rules
.taskrc.json              # Configuration (optional)
```

## Task Format

Taskwerk v2.0 uses YAML frontmatter for structured metadata with markdown content for rich descriptions:

```markdown
---
id: TASK-001
description: Fix authentication timeout on mobile Safari
status: in_progress
priority: high
category: bugs
assignee: @alice
estimated: 3h
created: 2025-06-30T10:00:00.000Z
updated: 2025-06-30T14:30:00.000Z
dependencies: []
subtasks:
  - id: TASK-001.1
    description: Reproduce issue in Safari
    status: completed
    assignee: @alice
  - id: TASK-001.2
    description: Implement session refresh logic
    status: in_progress
    assignee: @alice
timeline:
  - timestamp: 2025-06-30T10:00:00.000Z
    action: created
    user: @alice
  - timestamp: 2025-06-30T10:15:00.000Z
    action: started
    user: @alice
    note: Beginning investigation
  - timestamp: 2025-06-30T14:30:00.000Z
    action: subtask_completed
    user: @alice
    note: Successfully reproduced the issue
---

# Fix authentication timeout on mobile Safari

## Problem Description
Users on mobile Safari are experiencing session timeouts after 15 minutes of inactivity, even when actively using the application.

## Root Cause Analysis
The issue appears to be related to Safari's aggressive tab suspension policies that interfere with our session refresh mechanism.

## Proposed Solution
1. Implement heartbeat mechanism that works with Safari's background limitations
2. Add session storage fallback for suspended tabs
3. Graceful session recovery when tabs become active again

## Acceptance Criteria
- [ ] Session persists for full 30-minute timeout period
- [ ] Graceful handling of tab suspension/resumption
- [ ] No impact on other browsers' performance
- [ ] Unit tests cover edge cases

## Related Files
- `src/auth/session-manager.js`
- `src/utils/heartbeat.js`
- `tests/auth/safari-session.test.js`
```

**Task States:**
- `todo` - Ready to start
- `in_progress` - Currently being worked on
- `blocked` - Waiting for dependencies or external factors
- `completed` - Successfully finished
- `archived` - Cancelled or no longer relevant

**Enhanced Features:**
- **Dependencies**: Tasks can depend on other tasks being completed first
- **Subtasks**: Break large tasks into smaller, manageable pieces
- **Timeline**: Complete history of all task state changes and actions
- **Assignees**: Track who's responsible for each task (`@username` format)
- **Categories**: Organize tasks by type (bugs, features, docs, etc.)
- **Estimated Time**: Track planned effort (`2h`, `1d`, `1w` format)

## Configuration

Create `.taskrc.json` in your project root:

```json
{
  "defaultPriority": "medium",
  "defaultAssignee": "@me",
  "autoCreateBranch": true,
  "validateDependencies": true,
  "timelineTracking": true,
  "categories": {
    "bugs": "Bug Fixes",
    "features": "Features", 
    "docs": "Documentation",
    "refactor": "Code Refactoring",
    "tests": "Testing"
  },
  "estimateFormats": ["1h", "2h", "4h", "1d", "2d", "1w"],
  "workflowRules": {
    "requireEstimateForHighPriority": true,
    "autoCompleteSubtasks": true,
    "enforceAssigneeFormat": true
  }
}
```

**Configuration Options:**
- `defaultPriority`: Default priority for new tasks (high/medium/low)
- `defaultAssignee`: Default assignee for new tasks (@username format)
- `validateDependencies`: Check dependency completion before allowing task start
- `timelineTracking`: Enable detailed timeline tracking for all actions
- `categories`: Predefined categories for task organization
- `estimateFormats`: Valid time estimate formats
- `workflowRules`: Enforce team workflow standards

## Common Workflows

### Enhanced Project Management
```bash
# Daily workflow with v2.0 features
taskwerk add "Implement user settings page" --priority high --assignee @john --estimated 4h
taskwerk add-subtask TASK-005 "Design settings UI mockup"
taskwerk add-subtask TASK-005 "Implement backend API"
taskwerk add-subtask TASK-005 "Add frontend integration"
taskwerk list --assignee @john
taskwerk start TASK-005
# ... do the work ...
taskwerk complete TASK-005 --note "Added profile, preferences, and notifications"
taskwerk stats
```

### Dependency Management
```bash
# Complex feature with dependencies
taskwerk add "Set up authentication system" --priority high --assignee @alice
taskwerk add "Implement user dashboard" --assignee @bob
taskwerk add-dependency TASK-002 TASK-001  # Dashboard depends on auth

taskwerk ready-tasks                        # Shows only TASK-001 is ready
taskwerk start TASK-001                     # Alice starts auth work
taskwerk complete TASK-001                  # Auth system complete
taskwerk ready-tasks                        # Now shows TASK-002 is ready
taskwerk start TASK-002                     # Bob can start dashboard
```

### Team Collaboration with Timeline Tracking
```bash
# Enhanced team workflow
git pull                                    # Get latest tasks
taskwerk list --priority high --assignee @me
taskwerk start TASK-007 --note "Beginning investigation"
taskwerk block TASK-007 --reason "Waiting for API documentation from backend team"
# ... later when unblocked ...
taskwerk unblock TASK-007 --note "API docs received"
taskwerk complete TASK-007 --note "Implemented with Redis caching and error handling"
taskwerk timeline TASK-007                 # View complete task history
git push                                    # Share completed work
```

## AI Integration (Optional)

taskwerk supports optional AI assistance for natural language task management:

### Setup
```bash
# Interactive setup
taskwerk llmconfig --choose     # Select from available models

# Or set environment variable
export OPENAI_API_KEY="your-key"
```

### Usage
```bash
# Natural language commands
taskwerk ask "what should I work on next?"
taskwerk ask "add a task for fixing the memory leak"
taskwerk ask "show me all high priority bugs"

# AI can also work with tasks like:
taskwerk agent "start working on the authentication task"
```

**Supported Models:**
- **OpenAI**: GPT-4, GPT-4.1, .. (remote)
- **Anthropic**: Claude-3.5, Claude-3.7, ... (remote)
- **Ollama**: Local models (llama3.2, etc.)
- **LM Studio**: Local model server (similar to ollama)

See `taskwerk llmconfig --help` for complete setup guide.

## Commands Reference

### Enhanced Task Management
- `taskwerk add "description" [--priority] [--category] [--assignee] [--estimated]` - Add new task with v2.0 metadata
- `taskwerk list [--priority] [--category] [--assignee] [--completed] [--archived]` - List and filter tasks
- `taskwerk start TASK-ID [--note]` - Begin working on task (validates dependencies)
- `taskwerk complete TASK-ID [--note]` - Mark task completed with timeline tracking
- `taskwerk pause TASK-ID [--note]` - Return task to todo state with timeline entry
- `taskwerk block TASK-ID --reason "reason" [--note]` - Block task with reason tracking
- `taskwerk unblock TASK-ID [--note]` - Unblock task and resume work
- `taskwerk archive TASK-ID --reason "reason" [--superseded-by] [--note]` - Archive task permanently
- `taskwerk search "keyword"` - Search across all task fields

### Dependencies & Subtasks
- `taskwerk add-dependency TASK-ID DEPENDENCY-ID` - Add task dependency
- `taskwerk remove-dependency TASK-ID DEPENDENCY-ID` - Remove task dependency
- `taskwerk ready-tasks` - Show tasks ready to work on (no blocking dependencies)
- `taskwerk dependency-tree TASK-ID` - Show complete dependency hierarchy
- `taskwerk add-subtask TASK-ID "description" [--assignee]` - Add subtask to parent task
- `taskwerk update-subtask TASK-ID SUBTASK-ID [--status] [--assignee]` - Update subtask
- `taskwerk list-subtasks TASK-ID` - Show all subtasks for a task

### Information & Context
- `taskwerk status` - Current session with enhanced v2.0 information
- `taskwerk context TASK-ID` - Complete task details including dependencies and timeline
- `taskwerk timeline TASK-ID` - Show full task timeline and history
- `taskwerk stats` - Enhanced project statistics with v2.0 metrics
- `taskwerk recent [--limit]` - Recently completed tasks with details

### Git Integration
- `taskwerk branch TASK-ID` - Create/switch to feature branch
- `taskwerk stage [--auto] [--preview]` - Stage files with task context
- `taskwerk commit [--auto] [--message]` - Intelligent commits with Co-Authored-By tags

### AI Features (Optional)
- `taskwerk ask "question"` - Ask questions about tasks and dependencies
- `taskwerk agent "instruction"` - Have AI perform task operations with v2.0 features
- `taskwerk llmconfig [--list-models] [--add-key] [--choose]` - Configure AI models

### Configuration & Management
- `taskwerk init [path]` - Initialize Taskwerk with v2.0 format in project
- `taskwerk rules [--status] [--validate]` - View/edit workflow rules
- `taskwerk migrate` - Manually migrate v1 format to v2.0 (auto-migration available)
- `taskwerk about` - Version and help information

## Development & Contributing

### Setup
```bash
git clone https://github.com/yourusername/taskwerk.git
cd taskwerk
npm install
```

### Build & Test
```bash
npm test                 # Run all tests
npm run build           # Lint, format, test, and build
npm run lint            # Check code style
npm start               # Run local development version
```

See [BUILD.md](BUILD.md) for detailed build instructions.

## Requirements

- **Node.js**: 18.0.0 or higher
- **Git**: For git integration features (optional)
- **AI Models**: For natural language features (optional)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## What's New in v2.0

Taskwerk v2.0 brings significant enhancements while maintaining backward compatibility:

### 🚀 **YAML Frontmatter Architecture**
- Structured metadata with human-readable markdown content
- Rich task schema with validation
- Automatic migration from older formats

### 🔗 **Advanced Task Relationships** 
- **Dependencies**: Enforce task order and prerequisites
- **Subtasks**: Break complex work into manageable pieces
- **Timeline Tracking**: Complete audit trail of all changes

### 👥 **Enhanced Team Collaboration**
- **Assignee System**: Track responsibility with @username format
- **Categories & Estimates**: Better organization and planning
- **Blocking/Unblocking**: Handle external dependencies gracefully

### 🤖 **AI-Optimized Workflows**
- Enhanced integration with AI coding assistants
- Intelligent commit messages with task context
- Natural language task operations

## Philosophy

Taskwerk believes task management should be:
- **Structured yet Human**: YAML + Markdown for the best of both worlds
- **Relationship-Aware**: Tasks don't exist in isolation
- **Timeline-Conscious**: History matters for context and learning
- **AI-Collaborative**: Built for human-AI development workflows
- **Zero Lock-In**: Plain text files that work everywhere

Whether you're working solo, with a team, or with AI assistants, Taskwerk v2.0 provides the structured context and intelligent task management you need for modern software development.

---

*Structured task management for human-AI collaboration*