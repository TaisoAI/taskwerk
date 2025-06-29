# taskwerk-Assisted Git Workflow Plan

## Current State Analysis

### Current Issues
1. **Messy commit command**: `taskwerk commit` only commits current active task, not comprehensive
2. **No build versioning**: No automatic version bumping when tasks are completed
3. **Limited task tracking**: Task completion doesn't capture enough detail about changes made
4. **Disconnected workflows**: Git operations and task management are loosely integrated

### Existing Related Tasks
- **TASK-045**: Git commit integration workflow design
- **TASK-039**: Enhanced task completion tracking with file changes
- **TASK-034**: Better CLI output formatting 
- **TASK-035**: Making commands pipeable
- **TASK-027**: General workflow usability review

## Proposed taskwerk-Assisted Git Workflow

### Core Principles
1. **Task-Centric Development**: Every code change should be associated with a task
2. **Intelligent Commits**: Commit messages generated from completed task metadata
3. **Automatic Versioning**: Build numbers increment with each task completion
4. **Comprehensive Tracking**: Track files, changes, and side effects during task work
5. **Staged Workflow**: Multiple commands to support the full development cycle

### Proposed Command Flow

#### 1. Task Initiation
```bash
# Start working on a task (creates branch, tracks start time)
taskwerk start TASK-001

# taskwerk tracks:
# - Current task ID
# - Start timestamp
# - Initial git state (branch, last commit)
# - Working directory state
```

#### 2. Development Phase
```bash
# During development, taskwerk can track file changes
taskwerk track [files...]  # manually add files to tracking
taskwerk status           # show current task, tracked files, changes

# taskwerk automatically detects:
# - Modified files in git working directory
# - New files created
# - Dependencies added/removed (package.json changes)
```

#### 3. Task Completion with Enhanced Tracking
```bash
# Complete task with detailed tracking
taskwerk complete TASK-001 --note "Implemented user authentication" \
                           --level detailed

# Completion levels:
# - basic: Just task completion timestamp
# - standard: Files changed, basic description
# - detailed: Files changed, code changes summary, side effects, dependencies
```

#### 4. Pre-Commit Staging
```bash
# New command: Review and stage changes for commit
taskwerk stage [--auto] [--review]

# This command:
# - Shows all completed tasks since last commit
# - Lists files changed for each task
# - Allows selective staging of task-related changes
# - Generates preview of commit message
```

#### 5. Intelligent Commit Generation
```bash
# Enhanced commit command
taskwerk commit [--version-bump minor|patch|major] [--review]

# This command:
# - Generates commit message from all completed tasks
# - Includes file change summary
# - Optionally bumps version number
# - Allows review/editing before commit
```

### Enhanced Task Completion Tracking

#### Task Completion Metadata
When completing a task, taskwerk should capture:

```json
{
  "id": "TASK-001",
  "description": "Add user authentication",
  "completedAt": "2024-01-15T10:30:00Z",
  "duration": "2h 15m",
  "filesChanged": [
    {
      "path": "src/auth/auth.js",
      "action": "created",
      "linesAdded": 45,
      "description": "Main authentication logic"
    },
    {
      "path": "src/middleware/auth-middleware.js", 
      "action": "created",
      "linesAdded": 23,
      "description": "Express middleware for auth"
    },
    {
      "path": "package.json",
      "action": "modified",
      "description": "Added bcrypt and jsonwebtoken dependencies"
    }
  ],
  "sideEffects": [
    "Database schema updated with user_sessions table",
    "New environment variables required: JWT_SECRET"
  ],
  "notes": "Implemented JWT-based authentication with bcrypt password hashing",
  "detailLevel": "detailed"
}
```

### Commit Message Generation

#### Commit Message Format
```
feat: Implement user authentication system

Tasks completed:
- TASK-001: Add user authentication
- TASK-002: Update login page styling

Files modified:
- src/auth/auth.js (new): Main authentication logic
- src/middleware/auth-middleware.js (new): Express middleware
- src/components/LoginPage.jsx (modified): Updated styling
- package.json (modified): Added bcrypt, jsonwebtoken deps

Side effects:
- Database schema updated with user_sessions table
- New environment variables required: JWT_SECRET

Version: 0.1.1 → 0.1.2
```

### Version Management Integration

#### Automatic Version Bumping
```bash
# Version bumping based on task types/priorities
taskwerk complete TASK-001 --version-impact patch  # 0.1.1 → 0.1.2
taskwerk complete TASK-002 --version-impact minor  # 0.1.2 → 0.2.0
taskwerk complete TASK-003 --version-impact major  # 0.2.0 → 1.0.0

# Automatic detection based on:
# - Task priority (HIGH = minor, MEDIUM = patch, LOW = patch)
# - Task category (features = minor, bugs = patch, docs = patch)
# - File changes (breaking changes = major)
```

### New Commands Required

#### 1. Enhanced Completion
```bash
taskwerk complete TASK-ID [options]
  --note "completion note"
  --level basic|standard|detailed
  --version-impact patch|minor|major|none
  --files file1,file2,file3  # manually specify files
```

#### 2. Staging Command
```bash
taskwerk stage [options]
  --auto          # auto-stage all tracked changes
  --review        # interactive review of changes
  --preview       # show commit message preview
  --since COMMIT  # stage tasks completed since specific commit
```

#### 3. Enhanced Commit
```bash
taskwerk commit [options]
  --version-bump patch|minor|major  # force version bump
  --review                         # review message before commit
  --message "custom message"       # override generated message
  --include-incomplete            # include in-progress tasks in message
```

#### 4. File Tracking
```bash
taskwerk track <files...>     # manually track files for current task
taskwerk untrack <files...>   # remove files from tracking
taskwerk tracked              # show currently tracked files
```

#### 5. Workflow Status
```bash
taskwerk status [--verbose]
  # Shows:
  # - Current task
  # - Completed tasks since last commit
  # - Tracked/modified files
  # - Staging status
  # - Proposed version bump
```

### Configuration Options

#### .taskrc.json additions
```json
{
  "git": {
    "autoCommit": false,
    "autoVersionBump": true,
    "defaultVersionImpact": "patch",
    "commitMessageTemplate": "custom-template.md",
    "trackFilesAutomatically": true,
    "requireTaskForCommit": true
  },
  "completion": {
    "defaultDetailLevel": "standard",
    "alwaysTrackPackageJson": true,
    "detectSideEffects": true,
    "requireCompletionNotes": false
  }
}
```

### Implementation Priority

#### Phase 1: Enhanced Task Completion
1. Expand task completion metadata capture
2. Implement detailed file change tracking
3. Add completion detail levels

#### Phase 2: Staging Workflow  
1. Implement `taskwerk stage` command
2. Add commit message preview generation
3. Create interactive review process

#### Phase 3: Version Management
1. Implement automatic version bumping
2. Add version impact detection
3. Integrate with package.json updates

#### Phase 4: Polish & Integration
1. Improve CLI output formatting
2. Add pipeline support
3. Create comprehensive documentation

## Benefits of This Approach

1. **Comprehensive Tracking**: Every code change is associated with a task and properly documented
2. **Intelligent Commits**: Commit messages automatically reflect the work done
3. **Version Management**: Automatic, consistent version bumping based on changes
4. **Workflow Integration**: Git operations are tightly integrated with task management
5. **Historical Context**: Rich history of what was done and why
6. **Collaboration Support**: Team members can understand changes through task context

## Discussion Points

1. **Granularity**: How detailed should file change tracking be?
2. **Automation vs Control**: Balance between automatic tracking and manual control
3. **Performance**: Impact of extensive tracking on CLI responsiveness
4. **Backward Compatibility**: Migration path for existing taskwerk projects
5. **Error Handling**: What happens when git operations fail during task completion?
6. **Branch Management**: How does this integrate with feature branch workflows?