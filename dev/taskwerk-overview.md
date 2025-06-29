# taskwerk - A Simple Task Manager CLI

A lightweight command-line tool designed for LLM-assisted development workflows. Manages project tasks in markdown files with git integration, optimized for human-AI collaboration.

## Why This Tool?

**The Problem**: LLMs lose context between sessions and lack persistent task state management. Current tools don't bridge the gap between human project management and AI code generation effectively.

**The Solution**: A git-native, markdown-based task system that both humans and AI can read, write, and maintain collaboratively.

**Why not just use GH issues or JIRA**: Those tools are great but sometimes many intermediate tasks need to be created / debated on the fly so those tools are too heavy.

### Key Benefits
- 🤖 **LLM-Native**: Markdown format that AIs naturally understand
- 🔄 **Human-AI Handoffs**: Seamless collaboration between human oversight and AI execution  
- 📁 **Git-Integrated**: Tasks tracked alongside code changes
- 📝 **Zero Dependencies**: Plain text files that work everywhere
- ⚡ **Instant Setup**: Available via `npx` without installation

## Installation & Usage

### Quick Start (Recommended)
```bash
# Run without installation
npx taskwerk init <optional path>  # generates tasks.md and related files, default dir is project/tasks
npx taskwerk add "Fix login validation bug"
npx taskwerk list

# Create alias for convenience
alias task="npx taskwerk"
task add "Add dark mode support"
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

### 1. Add Task
```bash
task add "Task description" [--priority high|medium|low] [--category "Category"]

# Examples
task add "Fix memory leak in authentication"
task add "Add PDF export feature" --priority high --category "Features"
task add "Update documentation" --priority low --category "Docs"
```

### 2. List Tasks
```bash
task list                    # All active tasks
task list --priority high   # Filter by priority
task list --category api    # Filter by category (partial match)
task list --completed       # Show completed tasks
task list --current         # Show current session info
```

### 3. Manage Task State
```bash
task start TASK-001         # Claim task (mark in-progress)
task complete TASK-001      # Mark completed with auto-detection
task complete TASK-001 --note "Used OAuth 2.0 implementation"
task pause TASK-001         # Return to todo state
```

### 4. Session Management
```bash
task status                 # Show current session status
task context TASK-001       # Show task details and related files
task branch TASK-001        # Create/switch to feature branch
```

### 5. Search & Stats
```bash
task search "auth"          # Search task descriptions
task stats                  # Show task statistics
task recent                 # Show recently completed tasks
```

### 6. Git Integration Commands
```bash
task commit                 # Make commit with task context
task sync                   # Sync to GitHub (future feature)
```

### 7. Future Features
```bash
task --use-prd <file>       # Parse PRD into tasks (future)
```

## File Structure

The tool manages three files in your project (default: `project/tasks/`):

- `tasks.md` - Active tasks
- `tasks_completed.md` - Completed tasks with metadata
- `.task-session.json` - Current session state (git-ignored)

## Task Format

### Simple Task IDs
Tasks use sequential numbering: `TASK-001`, `TASK-002`, etc.

### Task States
- `[ ]` - Todo
- `[>]` - In Progress  
- `[x]` - Completed
- `[!]` - Blocked (requires human attention)

### Priority Levels
- `🔴 HIGH` - Critical/blocking issues
- `🟡 MEDIUM` - Standard priority (default)
- `🟢 LOW` - Nice-to-have improvements

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

## LLM Agent Integration

### For Claude Code / Cursor
```bash
# Agent workflow
task list --priority high           # See what to work on
task start TASK-003                 # Claim a task
task context TASK-003               # Get full context
# ... do the work ...
task complete TASK-003 --note "Implemented using React hooks pattern"
```

### MCP (Model Context Protocol) Support
taskwerk will support MCP for direct integration with AI editors like Cursor, enabling natural language task management through the AI interface.

### Context Preservation
Tasks include rich context for AI understanding:
- Full problem description
- Related files and functions
- Previous attempt notes
- Acceptance criteria

## Examples

### Daily Workflow
```bash
# Morning standup
task status
task list --priority high

# Claim work
task start TASK-005

# Ship it
task complete TASK-005 --note "Added rate limiting with Redis backend"

# Review progress  
task stats
```

### Team Handoffs
```bash
# Human adds context-rich task
task add "Optimize database query performance in user dashboard - currently taking 3-5 seconds, need under 500ms" --priority high --category "Performance"

# AI agent picks up work
task start TASK-007
task context TASK-007

# Complete with implementation details
task complete TASK-007 --note "Added database indexes on user_id and created_at columns, implemented query result caching with 5min TTL"
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

### Technology Stack
- **Runtime**: Node.js 18+ (ES modules)
- **CLI Framework**: Commander.js
- **File Operations**: Node.js fs/promises
- **Git Integration**: Simple git commands via child_process
- **Package Distribution**: NPM with npx support

### Key Features
1. **Zero-Config Start**: Works immediately in any git repository
2. **Smart ID Management**: Sequential numbering with gap handling
3. **Session Awareness**: Tracks current work state
4. **Git Integration**: Branch creation and file change detection
5. **Format Preservation**: Maintains markdown structure and formatting

### Error Handling
- Graceful degradation when git is unavailable
- Clear error messages with suggested fixes
- Automatic backup before destructive operations
- Recovery options for interrupted operations

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

### Development Roadmap

**Phase 1: MVP** (Ready for open source)
- Core task CRUD operations
- Basic git integration
- NPX distribution

**Phase 2: Enhanced Collaboration**
- MCP integration for AI editors
- GitHub Issues integration
- `task commit` and `task sync` commands

**Phase 3: Advanced Features**
- PRD parsing (`--use-prd`)
- Task dependencies
- VS Code extension

### Contributing
This tool is designed to be community-driven. Contributions welcome for:
- LLM agent integrations (Claude Code, Cursor, etc.)
- Additional git workflows
- Task template systems
- Integration with project management tools

### License
MIT License - Free for commercial and personal use

---

*Built for the future of human-AI collaborative development*