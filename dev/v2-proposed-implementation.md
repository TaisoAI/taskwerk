# TaskWerk v2.0 Proposed Implementation Plan

## Overview

TaskWerk v2 architcture represents an evolution from a simple task list to a comprehensive developer workflow tool, while maintaining the core principles of human-editability, git-friendliness, and CLI-first operation. This plan incorporates architectural insights from both internal analysis and external review feedback.

### Core Philosophy

**Unchanged Principles:**
- **Human-editable:** All files remain readable and manually editable
- **Git-friendly:** Plain text files that work well with version control
- **CLI-first:** Bulk of workflow through CLI commands, manual editing for refinement
- **Optional AI:** LLM integration enhances but doesn't replace core functionality

**New Architectural Foundation:**
- **YAML Frontmatter + Markdown:** Structured metadata in frontmatter, human story in markdown body
- **Layered Architecture:** Core task management separate from integrations (Git, etc.)
- **Predictable Magic:** All automation is explicit, deterministic, and user-controllable

## Current State Analysis

### v1.x Strengths to Preserve
- Simple two-file system (`tasks.md`, `tasks_completed.md`)
- Archive functionality with reason tracking (`[~]` status)
- Basic priority and category organization
- Session state management (`.task-session.json`)
- CLI command structure (`add`, `start`, `complete`, `archive`)

### v1.x Limitations to Address
1. **Insufficient task metadata:** No files, dependencies, subtasks, timeline tracking
2. **Fragile parsing:** Complex indented markdown prone to user errors
3. **Limited Git integration:** Basic commit message generation only
4. **No project-level visibility:** No dependency trees, critical paths, or progress tracking
5. **No workflow enforcement:** No validation rules or quality gates

## Proposed v2.0 Architecture

### Task Format: YAML Frontmatter + Markdown

**Rationale:** Separates machine-readable metadata from human-readable content, making CLI operations robust while preserving manual editability.

```markdown
---
id: TASK-045
created: 2025-06-29T14:30:00Z
priority: high
category: bugs
assignee: @johndoe
dependencies: [TASK-043, TASK-044]
estimated: 4h
state: in-progress
timeline:
  - started: 2025-06-29T15:00:00Z
  - paused: 2025-06-29T16:30:00Z
  - resumed: 2025-06-30T09:00:00Z
git:
  commits:
    - abc123f: Fix session timeout calculation
    - def456a: Add comprehensive tests
files:
  - src/auth/session-manager.js
  - tests/auth/session-timeout.test.js
subtasks:
  - id: TASK-045.1
    description: Update timeout logic
    state: completed
  - id: TASK-045.2
    description: Add error handling
    state: in-progress
---

# Fix user authentication timeout issue

**Description:**
Users are being logged out after 30 minutes of inactivity instead of the configured 2 hours. This appears to be related to the session token refresh mechanism not properly extending the expiration time.

**Acceptance Criteria:**
- Session timeout should respect the 2-hour configuration
- Token refresh should properly extend session duration
- Add tests to verify timeout behavior

**Notes:**
Found that the token refresh was using client timestamp instead of server timestamp, causing drift issues.
```

### Layered Architecture

```
┌─────────────────────────────────────────┐
│            Integration Layer            │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │ Git Adapter │  │ Future: Jira,   │  │
│  │             │  │ Slack, etc.     │  │
│  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────┤
│              Core Domain                │
│  ┌─────────────────────────────────────┐ │
│  │ Task Lifecycle Management           │ │
│  │ • add, start, block, complete      │ │
│  │ • dependencies, subtasks           │ │
│  │ • timeline, file tracking          │ │
│  └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│             Storage Layer               │
│  ┌─────────────────────────────────────┐ │
│  │ YAML Frontmatter Parser/Writer     │ │
│  │ • Robust parsing                   │ │
│  │ • Error recovery                   │ │
│  │ • Schema validation                │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core Foundation (TASK-077.1)
**Goal:** Establish robust YAML frontmatter parsing and core task model

#### 1.1 YAML Frontmatter Parser
- [ ] **TASK-077.1.1** Research and select YAML parsing library (js-yaml)
- [ ] **TASK-077.1.2** Create new TaskParser class supporting YAML frontmatter
- [ ] **TASK-077.1.3** Implement schema validation for task frontmatter
- [ ] **TASK-077.1.4** Add error recovery for malformed tasks (skip broken tasks, continue parsing)
- [ ] **TASK-077.1.5** Create migration utility to convert v1 tasks to v2 format

#### 1.2 Enhanced Task Model
- [ ] **TASK-077.1.6** Define v2 task schema with all metadata fields
- [ ] **TASK-077.1.7** Update TaskManager to handle new task structure
- [ ] **TASK-077.1.8** Implement timeline auto-management (CLI commands update timeline)
- [ ] **TASK-077.1.9** Add subtask creation and management
- [ ] **TASK-077.1.10** Implement dependency tracking and validation

#### 1.3 Backward Compatibility
- [ ] **TASK-077.1.11** Support reading v1 format tasks during transition
- [ ] **TASK-077.1.12** Gradual migration path (convert tasks as they're modified)
- [ ] **TASK-077.1.13** Update existing CLI commands to work with both formats

**Deliverables:**
- Robust YAML frontmatter parsing
- Enhanced task model with metadata
- Migration path from v1 to v2
- All existing functionality preserved

**Acceptance Criteria:**
- Can parse v2 format with 100% reliability
- Graceful error handling for malformed tasks
- v1 tasks continue to work during migration
- All existing tests pass

### Phase 2: Enhanced CLI Commands (TASK-077.2)
**Goal:** Implement new commands for advanced task management

#### 2.1 Core Command Enhancements
- [ ] **TASK-077.2.1** Update `add` command with full metadata support
- [ ] **TASK-077.2.2** Enhance `start`/`complete` to auto-update timeline
- [ ] **TASK-077.2.3** Add file tracking with `git status` integration and user confirmation
- [ ] **TASK-077.2.4** Implement `block`/`unblock` commands for dependency management

#### 2.2 New Dependency Commands
- [ ] **TASK-077.2.5** Add `taskwerk depends TASK-A TASK-B` command
- [ ] **TASK-077.2.6** Create `taskwerk tree TASK-ID` for dependency visualization
- [ ] **TASK-077.2.7** Implement `taskwerk ready` to show tasks with no blockers
- [ ] **TASK-077.2.8** Add `taskwerk critical-path` for project analysis

#### 2.3 Subtask Management
- [ ] **TASK-077.2.9** Add `taskwerk subtasks TASK-ID` command
- [ ] **TASK-077.2.10** Implement `taskwerk progress TASK-ID` for completion percentage
- [ ] **TASK-077.2.11** Create subtask creation via `--parent` flag

#### 2.4 Enhanced Filtering and Reporting
- [ ] **TASK-077.2.12** Update `list` command with dependency and subtask display
- [ ] **TASK-077.2.13** Add `taskwerk timeline TASK-ID` for audit trail
- [ ] **TASK-077.2.14** Implement `taskwerk worklog` for time tracking summary
- [ ] **TASK-077.2.15** Create `taskwerk report` for generating metrics from tasks

**Deliverables:**
- Complete command set for v2 functionality
- Dependency management capabilities
- Progress tracking and reporting
- Timeline and audit functionality

**Acceptance Criteria:**
- All new commands have comprehensive help
- Commands auto-update timeline appropriately
- File tracking is explicit and user-controlled
- Dependency validation prevents circular dependencies

### Phase 3: Git Integration Layer (TASK-077.3)
**Goal:** Build Git integration as a separate adapter layer

#### 3.1 Core Git Commands
- [ ] **TASK-077.3.1** Enhance `commit` command with task-specific staging
- [ ] **TASK-077.3.2** Implement `taskwerk commit TASK-ID` for single-task commits
- [ ] **TASK-077.3.3** Add `taskwerk commit --all-ready` for multi-task commits
- [ ] **TASK-077.3.4** Create `taskwerk stage --preview` for commit preview

#### 3.2 Advanced Git Features
- [ ] **TASK-077.3.5** Implement intelligent commit message generation from task metadata
- [ ] **TASK-077.3.6** Add automatic git commit linking to task metadata
- [ ] **TASK-077.3.7** Create branch naming suggestions based on task IDs
- [ ] **TASK-077.3.8** Implement `taskwerk git-hooks install` helper

#### 3.3 Git Hook Integration
- [ ] **TASK-077.3.9** Pre-commit hook for file/task validation
- [ ] **TASK-077.3.10** Post-commit hook for automatic commit linking
- [ ] **TASK-077.3.11** Commit message validation hook

**Deliverables:**
- Complete Git integration as adapter layer
- Intelligent commit message generation
- Automated commit linking
- Git hooks for workflow enforcement

**Acceptance Criteria:**
- Git integration doesn't affect core task management
- Commit messages provide clear context and history
- Hooks are optional and easily installable
- Works correctly in team environments

### Phase 4: Advanced Features (TASK-077.4)
**Goal:** Add power-user features and team collaboration tools

#### 4.1 Workflow Rules and Validation
- [ ] **TASK-077.4.1** Implement `taskwerk-rules.md` parsing and enforcement
- [ ] **TASK-077.4.2** Add workflow validation (test requirements, documentation, etc.)
- [ ] **TASK-077.4.3** Create configurable quality gates
- [ ] **TASK-077.4.4** Implement warning/error system for rule violations

#### 4.2 Task Templates
- [ ] **TASK-077.4.5** Create task template system
- [ ] **TASK-077.4.6** Add `taskwerk add --template feature` command
- [ ] **TASK-077.4.7** Implement template customization and sharing

#### 4.3 Time Tracking and Estimates
- [ ] **TASK-077.4.8** Add estimation accuracy tracking
- [ ] **TASK-077.4.9** Implement `taskwerk estimate TASK-ID --actual 4h`
- [ ] **TASK-077.4.10** Create velocity and burndown reporting

#### 4.4 Team Features
- [ ] **TASK-077.4.11** Add assignee management and filtering
- [ ] **TASK-077.4.12** Implement team workload distribution analysis
- [ ] **TASK-077.4.13** Create cross-task dependency visualization

**Deliverables:**
- Workflow rule enforcement
- Task templates and time tracking
- Team collaboration features
- Advanced reporting and analytics

**Acceptance Criteria:**
- Rules provide helpful guidance without being intrusive
- Templates accelerate common task creation patterns
- Time tracking improves estimation accuracy
- Team features scale to multiple contributors

## File Structure Changes

### Enhanced Directory Structure
```
tasks/
├── tasks.md              # Active tasks (v2 YAML frontmatter format)
├── tasks_completed.md    # Completed tasks (enhanced format)
├── tasks_archived.md     # Archived tasks (if separated)
├── taskwerk-rules.md     # Workflow rules and guidelines
├── templates/            # Task templates
│   ├── feature.md
│   ├── bug.md
│   ├── epic.md
│   └── spike.md
└── .taskwerk/            # Generated files (gitignored)
    ├── metrics/
    │   ├── velocity.json
    │   ├── estimates.json
    │   └── timeline.json
    └── cache/
        └── dependency-graph.json
```

### Configuration Schema
```json
{
  "taskwerk": {
    "version": "2.0",
    "format": "yaml-frontmatter",
    "templates": {
      "defaultTemplate": "standard",
      "customTemplates": ["feature", "bug", "epic", "spike"]
    },
    "git": {
      "autoLinkCommits": true,
      "branchNaming": "feature/task-{id}-{slug}",
      "requireTaskReference": true,
      "hooksEnabled": false
    },
    "workflow": {
      "requireEstimates": false,
      "autoTrackTime": true,
      "dependencyChecking": true,
      "rulesFile": "tasks/taskwerk-rules.md"
    },
    "display": {
      "showSubtasks": true,
      "showDependencies": true,
      "showTimeline": false,
      "maxRecent": 20
    }
  }
}
```

## Migration Strategy

### Gradual Migration Path
1. **v2.0 Release:** Supports both v1 and v2 formats
2. **Migration Tool:** `taskwerk migrate --format v2` converts existing tasks
3. **Hybrid Operation:** New tasks created in v2 format, old tasks readable as v1
4. **Lazy Migration:** Tasks converted to v2 when modified via CLI
5. **Full Migration:** After team adoption, migrate all remaining v1 tasks

### Compatibility Layer
- v1 format parser remains for reading existing tasks
- CLI commands work with both formats
- New features only available in v2 format
- Clear migration path and documentation

## Risk Mitigation

### Technical Risks
1. **YAML Parsing Complexity:** Mitigated by robust error handling and schema validation
2. **Performance Impact:** Lazy loading and caching for large task sets
3. **Migration Issues:** Extensive testing and gradual rollout strategy
4. **Backward Compatibility:** Maintain v1 parser throughout v2.0 lifecycle

### User Experience Risks
1. **Learning Curve:** Comprehensive documentation and gradual feature introduction
2. **Workflow Disruption:** Maintain all existing functionality during transition
3. **File Format Confusion:** Clear examples and migration tooling
4. **Feature Overload:** Phased rollout with optional advanced features

## Success Metrics

### Technical Success
- [ ] 100% reliability in YAML frontmatter parsing
- [ ] Zero data loss during migration
- [ ] All v1 functionality preserved in v2
- [ ] Comprehensive test coverage (>95%)

### User Experience Success
- [ ] Reduced time to complete common workflows
- [ ] Improved task visibility and dependency management
- [ ] Better Git integration and commit quality
- [ ] Positive user feedback on new features

### Adoption Success
- [ ] Smooth migration path for existing users
- [ ] Clear documentation and examples
- [ ] Active use of advanced features (dependencies, subtasks)
- [ ] Community contribution to templates and rules

## Next Steps

1. **Review with Fred:** Get external validation of implementation plan
2. **Create Phase 1 Tasks:** Break down Phase 1 into specific, actionable tasks
3. **Prototype YAML Parser:** Build proof-of-concept for frontmatter parsing
4. **Define Task Schema:** Finalize v2 task structure and validation rules
5. **Begin Implementation:** Start with Phase 1.1 (YAML Frontmatter Parser)

This plan transforms TaskWerk from a simple task manager into a comprehensive developer workflow tool while preserving its core philosophy of simplicity, human-editability, and CLI-first operation.