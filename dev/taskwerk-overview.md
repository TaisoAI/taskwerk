# TaskWerk v3 - The Smart Supervisor for AI-Assisted Development

A powerful CLI-first task management system designed specifically for human-AI collaborative development workflows. Uses SQLite for robust data management with intelligent markdown exports for human readability.

## Why This Tool?

**The Problem**: LLMs lose context between sessions and struggle with large markdown files. Current tools don't provide the structured, queryable task context that AI agents need for effective collaboration.

**The Solution**: A SQLite-backed task system with intelligent context generation, dependency management, and rich Git integration. CLI-first design with beautiful markdown exports (and imports) for human review.

**Why not just use GitHub Issues or JIRA**: Those tools are excellent for formal project management, but development requires rapid task creation, complex dependencies, and intimate Git integration that heavyweight tools can't provide.

### Key Benefits
- 🤖 **Agent-Optimized**: Intelligent context generation without token explosion
- 🔗 **Smart Dependencies**: Complex task relationships with circular detection
- 📊 **Contextual Summaries**: AI agents get precise, targeted information
- 🔄 **Seamless Git Integration**: Automatic branches, intelligent commits
- 🏗️ **Robust Architecture**: SQLite backend ensures data integrity and performance
- ⚡ **CLI-First**: Fast, scriptable operations for both humans and agents

## Installation & Usage

### Quick Start (Recommended)
```bash
# Initialize TaskWerk v3 with SQLite backend
npx taskwerk init

# Creates:
# - taskwerk.db (SQLite database - source of truth)
# - tasks/taskwerk-rules.md (workflow rules for humans & agents)
# - .gitignore entries for session files

# Start using immediately
npx taskwerk add "Fix login validation bug"
npx taskwerk list

# Create alias for convenience
alias task="npx taskwerk"
task add "Add dark mode support" --priority high --assignee @me
```

### Local Installation
```bash
npm install -g taskwerk
task --help
```

### Project Integration
```bash
# Add to package.json scripts
{
  "scripts": {
    "task": "npx taskwerk"
  }
}

npm run task add "Refactor auth module"
```

## Core Commands

### 1. Task Management
```bash
# Rich task creation with metadata
task add "Implement user dashboard" --priority high --assignee @alice --estimate 3d
task add "Fix auth timeout" --category bugs --depends TASK-001

# Advanced listing and filtering
task list --priority high --assignee @me
task ready                  # Show tasks ready to start (no blockers)
task search "auth" --include-notes
```

### 2. Workflow Operations
```bash
task start TASK-001         # Start work (creates branch, updates status)
task pause TASK-001         # Pause with reason tracking
task complete TASK-001      # Complete with validation and git integration
task block TASK-001 --reason "Waiting for API review"
```

### 3. Dependencies & Relationships
```bash
task depends TASK-002 TASK-001    # TASK-002 depends on TASK-001
task tree TASK-001                # Show dependency hierarchy
task subtask TASK-001 "Write tests" --assignee @bob
```

### 4. Intelligent Context & Summaries
```bash
task summary --agent-context TASK-001    # Get focused context for agents
task summary --completed --since yesterday --author @me
task summary --search "authentication" --include-history
```

### 5. Git Integration
```bash
task branch TASK-001        # Create feature branch
task commit --task TASK-001 # Generate smart commit with task context
task git hooks install     # Setup automated Git workflows
```

### 6. Team Collaboration
```bash
task team --workload        # View team capacity and distribution
task assign TASK-001 @alice # Assign tasks to team members
task team --standup         # Generate daily standup report
```

## Architecture & Storage

### v3 Core Architecture
- **SQLite Database**: `taskwerk.db` - Single source of truth for all task data
- **Intelligent Exports**: Rich markdown exports for human review and Git diffs
- **Session Tracking**: `.task-session.json` - Current work state (git-ignored)
- **Workflow Rules**: `tasks/taskwerk-rules.md` - Project-specific guidelines

### File Structure
```
project/
├── taskwerk.db              # SQLite database (primary storage)
├── tasks/
│   ├── taskwerk-rules.md    # Workflow rules for humans & agents
│   └── exports/             # Generated markdown exports
├── .task-session.json       # Current session state
└── .taskrc.json            # Project configuration
```

### Task Data Model
- **Rich Metadata**: Dependencies, subtasks, assignees, estimates, categories
- **Timeline Tracking**: Complete audit trail of all task events
- **File Associations**: Automatic tracking of files modified during task work
- **Git Integration**: Commit hashes, branch names, merge information
- **Notes & Context**: Timestamped notes from humans and AI agents

## Git Integration

### Automatic Detection
- **Current Branch**: Auto-detected for task context
- **Commit Hash**: Added to completion metadata
- **File Changes**: Tracked when completing tasks

### Branch Management
```bash
task branch TASK-001        # Creates branch: feature/task-001-fix-login-bug
task complete TASK-001      # Auto-detects changed files since branch creation
```

## Configuration

Create `.taskrc.json` in your project root:

```json
{
  "tasksFile": "tasks.md",
  "completedFile": "tasks_completed.md",
  "autoCommit": false,
  "autoCreateBranch": true,
  "defaultPriority": "medium",
  "categories": {
    "bugs": "🐛 Bug Fixes",
    "features": "✨ Features", 
    "docs": "📚 Documentation",
    "refactor": "♻️ Refactoring",
    "test": "🧪 Testing"
  }
}
```

## Agent & AI Integration

### Intelligent Context Generation
```bash
# Agent gets focused context without token explosion
task summary --agent-context TASK-003
# Returns: task details, dependencies, related work, file context

# Natural language queries
task ask "What authentication tasks are currently blocked?"
# Returns: structured analysis of auth-related blockers

# Agent claims and works on tasks
task start TASK-003 --agent "claude-3"
task complete TASK-003 --agent "claude-3" --note "Implemented with error handling"
```

### Smart Context Features
- **Targeted Summaries**: Agents get precise, relevant information
- **Relationship Queries**: Find related tasks by files, keywords, dependencies
- **Historical Context**: Learn from similar past tasks and solutions
- **Token Optimization**: No more parsing huge markdown files
- **Agent Learning**: System tracks and applies agent insights

### Future: MCP Support
TaskWerk v3 will support MCP (Model Context Protocol) for direct integration with AI editors, enabling seamless task management through natural language interfaces.

## Examples

### Daily Development Workflow
```bash
# Morning: Check what's ready to work on
task ready --assignee @me
task summary --completed --since yesterday

# Start work with automatic Git integration
task start TASK-005  # Creates branch, updates status, starts tracking

# During work: Track files and add context
task track src/auth/ tests/auth/
task note TASK-005 "Implementing rate limiting with Redis backend"

# Complete with validation and smart commit
task complete TASK-005 --auto-commit
# Runs tests, generates commit with task context, updates dependencies
```

### Agent Collaboration Workflow
```bash
# Agent requests context for new work
task summary --agent-context TASK-007
# Gets: task details, dependencies, related files, implementation hints

# Agent works and learns
task start TASK-007 --agent "claude-3"
task complete TASK-007 --agent "claude-3" \
  --note "Added indexes on user_id and created_at, implemented Redis caching" \
  --learned "Database optimization pattern for time-series queries"

# Human reviews agent work
task timeline TASK-007  # See complete history of agent's work
```

---

## Example Files

### tasks.md
```markdown
# Project Tasks

*Last updated: 2024-12-15 14:30*
*Current session: Claude Code on feature/auth-improvements*

## 🔴 HIGH Priority

### 🐛 Bug Fixes
- [>] **TASK-001** Fix authentication timeout on mobile Safari - Users getting logged out after 2 minutes instead of 30 minutes
- [ ] **TASK-004** Memory leak in WebSocket connection handling - Memory usage grows 10MB/hour during active sessions

### ✨ Features  
- [ ] **TASK-002** Add two-factor authentication support - Integrate TOTP with QR code generation for account security

## 🟡 MEDIUM Priority

### ♻️ Refactoring
- [ ] **TASK-003** Migrate user service from REST to GraphQL - Consolidate 12 endpoints into unified graph schema
- [!] **TASK-006** Update deprecated crypto library - **BLOCKED**: Waiting for security team approval on replacement library

### 📚 Documentation
- [ ] **TASK-005** Create API integration guide - Include authentication, rate limiting, and common use cases

## 🟢 LOW Priority

### 🧪 Testing
- [ ] **TASK-007** Add end-to-end tests for checkout flow - Cover happy path and 3 common error scenarios
- [ ] **TASK-008** Increase unit test coverage to 85% - Currently at 72%, focus on utils and validation modules

---
*Total: 8 active tasks (1 in-progress, 1 blocked)*
```

### tasks_completed.md
```markdown
# Completed Tasks

## December 2024

### 🐛 Bug Fixes - v2.1.3 (2024-12-15)
- ✅ **TASK-012** Fixed login form validation edge cases - *completed on feature/login-validation - commit: a1b2c3d*
  - Added proper email format validation using RFC 5322 regex
  - Handled special characters in passwords correctly  
  - Added client-side validation with server-side backup
  - **Files changed**: `auth/validation.js`, `components/LoginForm.tsx`, `auth.test.js`

- ✅ **TASK-015** Resolved dashboard loading timeout - *completed on main - commit: d4e5f6g*
  - Implemented lazy loading for dashboard widgets
  - Added loading skeletons for better UX
  - Reduced initial bundle size by 40%
  - **Files changed**: `pages/Dashboard.tsx`, `components/Widget.tsx`, `utils/lazy-loader.js`

### ✨ Features - v2.2.0 (2024-12-14)  
- ✅ **TASK-009** Implemented dark mode support - *completed on feature/dark-mode - commit: h7i8j9k*
  - Added CSS custom properties for theme switching
  - Created theme toggle component with smooth transitions
  - Stored user preference in localStorage with system detection fallback
  - Added Storybook documentation for all theme variants
  - **Files changed**: `styles/themes.css`, `components/ThemeToggle.tsx`, `hooks/useTheme.js`

- ✅ **TASK-011** Added PDF export functionality - *completed on feature/pdf-export - commit: l1m2n3o*
  - Integrated puppeteer for server-side PDF generation
  - Added CLI option: `--format pdf` for report exports
  - Implemented custom styling for print layouts
  - Added progress indicators for long exports
  - **Files changed**: `services/pdf-generator.js`, `cli/export-command.js`, `styles/print.css`

### ♻️ Refactoring - v2.1.2 (2024-12-12)
- ✅ **TASK-010** Migrated from Redux to Zustand - *completed on refactor/state-management - commit: p4q5r6s*
  - Reduced bundle size by 15KB gzipped
  - Simplified state management with 60% less boilerplate
  - Maintained backward compatibility with existing components
  - Added TypeScript definitions for all stores
  - **Files changed**: `store/`, `hooks/useStore.js`, `components/` (12 files updated)

---
*Completed this month: 6 tasks*
*Average completion time: 2.3 days*
*Lines of code changed: 2,847 additions, 1,203 deletions*
```

### .task-session.json (auto-generated)
```json
{
  "currentTask": "TASK-001",
  "startedAt": "2024-12-15T14:30:00Z",
  "branch": "feature/auth-timeout-fix",
  "agent": "Claude Code",
  "baseBranch": "main",
  "filesModified": [
    "auth/session-manager.js",
    "config/auth-config.js"
  ],
  "lastActivity": "2024-12-15T15:45:00Z"
}
```

## Technical Implementation

### v3 Technology Stack
- **Runtime**: Node.js 18+ (ES modules)
- **Database**: SQLite3 with WAL mode for performance
- **CLI Framework**: Commander.js with rich formatting
- **Git Integration**: Advanced git operations via child_process
- **Query Engine**: SQL-based with intelligent caching
- **Export System**: YAML/Markdown generation with templates

### v3 Key Features
1. **Robust Data Storage**: SQLite ensures ACID compliance and concurrent access
2. **Intelligent Context**: AI-optimized summaries and relationship queries
3. **Advanced Git Workflows**: Smart commits, branch management, hooks
4. **Dependency Management**: Complex relationships with cycle detection
5. **Agent Integration**: Structured APIs for AI collaboration
6. **Performance Scaling**: Efficient queries for large project datasets

### Architecture Benefits
- **Data Integrity**: Referential integrity and transaction safety
- **Performance**: Fast queries on complex relationships
- **Scalability**: Handles thousands of tasks without degradation
- **Flexibility**: Rich metadata without parsing complexity
- **Reliability**: Atomic operations with rollback capability

## Open Source Contribution

### Repository Structure
```
taskwerk/
├── src/
│   ├── commands/          # CLI command implementations
│   ├── core/             # Task management logic
│   ├── git/              # Git integration utilities
│   └── utils/            # Helper functions
├── tests/                # Test suite
├── examples/             # Example workflows
├── docs/                 # Documentation
└── package.json          # NPX-ready configuration
```

### v3 Development Roadmap

**Phase 1: Foundation (v0.3.0)**
- SQLite database with full schema
- Core API and CLI command conversion
- Robust import/export for migration

**Phase 2: Intelligence (v0.3.1)**
- Intelligent context generation system
- Advanced dependency management
- Rich summary and query capabilities

**Phase 3: Automation (v0.4.0+)**
- Smart Git workflow supervision
- Agent collaboration protocols
- MCP integration for AI editors

### Contributing
This tool is designed to be community-driven. Contributions welcome for:
- LLM agent integrations (Claude Code, Cursor, etc.)
- Additional git workflows
- Task template systems
- Integration with project management tools

### License
MIT License - Free for commercial and personal use

---

## The v3 Vision

TaskWerk v3 represents the evolution from a simple markdown task manager to a **smart supervisor for AI-assisted development**. By embracing a CLI-first, SQLite-backed architecture, we've built a system that:

- **Scales with project complexity** without losing simplicity
- **Empowers AI agents** with intelligent, contextual information
- **Maintains human readability** through beautiful markdown exports
- **Ensures data integrity** with robust database foundations
- **Enables sophisticated workflows** while preserving developer-centric design

The soul of TaskWerk isn't in its storage format—it's in empowering developers and AI agents to collaborate effectively on complex software projects.

*Built for the future of human-AI collaborative development*