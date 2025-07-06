
### **Taskwerk v3: A Comprehensive Architecture for Agent-First Development**

**To:** Claude, Andrei
**From:** Fred
**Date:** July 3, 2025

> **HARMONIZATION NOTE (2025-01-06):** This document contains valuable architectural insights but has some terminology conflicts with the refocused v3 design. Please refer to `v3-canonical-reference.md` for authoritative definitions of:
> - Task states (use `active` not `in_progress`)
> - Command structure (use subcommands not flat commands)
> - Notes implementation (dual approach: field + table)
> - Database schema (see canonical reference)
> 
> The core architectural principles in this document remain valid.


Here is the comprehensive overview of Taskwerk v3.

**1. Preamble & Vision**

Taskwerk began with a simple, powerful idea: a frictionless, CLI-first task manager for developers that lives alongside their code. The initial Markdown-based versions successfully captured the *spirit* of this vision—human-readability, Git-friendliness, and developer-centricity.

However, practical use has illuminated a more ambitious destiny. Taskwerk's ultimate potential is not just to be a better `todo.md`, but to become the **smart supervisor for AI-assisted development.**

The vision for Taskwerk v3 is to provide the critical scaffolding, process guardrails, and automation for development workflows involving both humans and AI coding agents. It will enforce best practices, preserve context, and automate tedious mechanics, allowing humans and bots to focus on their respective strengths. This requires an evolution of our architecture to a system that is not just readable, but robust, queryable, transactional, and API-driven.

**2. The Core Problem & Justification for Change**

Our collective experience using Taskwerk v0.2.x has made five things abundantly clear:

1.  **Complex Relationships are Essential:** The need to split tasks into subtasks and manage dependencies is a core requirement for any meaningful project. Managing these complex relational hierarchies in flat text files is fragile and computationally expensive.
2.  **The API is the True "Magic":** While hand-editing was a starting point, the real power of Taskwerk lies in its scriptable API, exposed via the CLI. The most valuable workflows—generating smart commit messages, enforcing test runs, tracking file changes—depend on fast, reliable operations.
3.  **The Workflow Demands a Real Database:** To reliably guide developers and AI bots through complex workflows, we need a backend that guarantees data integrity (like unique IDs), prevents race conditions, and can be queried efficiently.
4.  **CLI Has Become Dominant:** In practice, the CLI has become the primary interface, not markdown editing. This is natural evolution - as the tool becomes more powerful, direct file manipulation becomes both less necessary and more dangerous. Manual editing of growing markdown files is brittle, especially for ID consistency and dependency management when agents run in quick loops.
5.  **Intelligent Context is Essential:** Large markdown files create token explosion for LLMs and poor targeting for agents. We need rich, contextual summaries and intelligent search capabilities that are impossible with flat file parsing.

The v2 architecture, while true to the original text-based ethos, cannot robustly support this advanced vision. It is time to evolve.

**3. The v3 Layered Architecture**

Taskwerk v3 will adopt a layered, API-centric architecture that combines the robustness of a database with the accessibility of plain text artifacts.

**The Core Principle:** The **database** is the single source of truth. The **API** is the single gateway to that truth.

```
+----------------------------------------------------------------------+
|                           Interfaces                                 |
|  +-----------------+   +--------------+   +------------------------+ |
|  |   Taskwerk CLI  |   |  AI Agents   |   | Future: MCP, Web UI    | |
|  +--------+--------+   +-------+------+   +-----------+------------+ |
+-----------|--------------------|----------------------|--------------+
            |                    |                      |
+-----------v--------------------v----------------------v--------------+
|                          API Layer                                   |
|       (A well-defined set of internal endpoints/functions)           |
|      (e.g., api.createTask, api.getTask, api.completeTask)           |
+---------------------------+------------------------------------------+
                            |
+---------------------------v------------------------------------------+
|                      Core Logic Layer                                |
|   (Task Management, Workflow Enforcement, Git Integration Logic)     |
+---------------------------+------------------------------------------+
                            |
+---------------------------v------------------------------------------+
|                       Storage Layer                                  |
|  +-----------------------------------------------------------------+ |
|  |                     SQLite Database                             | |
|  |                     (taskwerk.db)                               | |
|  +-----------------------------------------------------------------+ |
+----------------------------------------------------------------------+
                            ^
                            | (Import/Export Module in Core Logic)
+---------------------------+------------------------------------------+
|                        Artifact Layer                                |
|  +-----------------------------------------------------------------+ |
|  |                Markdown + YAML Files                            | |
|  |    (Human-Readable Snapshots, Onboarding, `git diff` Context)    | |
|  +-----------------------------------------------------------------+ |
+----------------------------------------------------------------------+
```

**Architectural Layers Explained:**

*   **Interfaces:** The "clients" of Taskwerk.
    *   **Taskwerk CLI:** The primary human interface. It will be a thin wrapper, making calls directly to the internal API.
    *   **AI Agents:** Bots will interact with Taskwerk by calling the CLI, ensuring they follow the same rules and workflows as human users.
    *   **Future Integrations:** This architecture allows for future interfaces like a Web UI or a Machine Control Protocol (MCP) endpoint to be added easily by having them call the same central API, preventing functionality gaps.
*   **API Layer:** The heart of the application. It exposes a clean, internal set of functions (e.g., `createTask`, `updateTaskStatus`) that the interfaces use. This enforces a single, validated path for all data modifications.
*   **Core Logic Layer:** Contains the business logic for tasks, Git integration, and workflow rules. The API layer calls functions here to execute commands.
*   **Storage Layer:** Manages the physical storage of data. Its only job is to execute database queries on behalf of the Core Logic layer.
*   **Artifact Layer:** These are not the source of truth. They are human-readable `md` files generated by the `export` command for review, `git diff` history, and bulk `import`.

**4. The SQLite Database Schema**

To support our rich feature set, we will use a relational schema. This design handles complex data like dependencies and historical notes with grace and efficiency.

*   **`tasks` table:** The central hub for all task information.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key, auto-incrementing. The rock-solid, unique ID. |
| `name` | `TEXT` | The short, descriptive title of the task. |
| `description`| `TEXT` | The longer, detailed description and context. |
| `status` | `TEXT` | `todo`, `in_progress`, `blocked`, `completed`, `error`. |
| `priority` | `TEXT` | `high`, `medium`, `low`. |
| `created_at` | `DATETIME`| Timestamp when the task was created. |
| `updated_at` | `DATETIME`| Timestamp of the last modification. |
| `completed_at`| `DATETIME`| `NULL` if not complete, timestamp of completion otherwise. |

*   **Linking Tables:** These tables manage one-to-many and many-to-many relationships.
| Table Name | Columns | Purpose |
| :--- | :--- | :--- |
| `task_dependencies` | `task_id`, `depends_on_id` | Manages the `depends on` list for each task. |
| `task_notes` | `id`, `task_id`, `note`, `created_at`, `author` | Creates a timestamped audit trail of notes for a task. |
| `task_files` | `id`, `task_id`, `file_path` | Tracks the list of files affected by a task. |
| `task_keywords` | `id`, `task_id`, `keyword` | Manages a flexible list of tags/keywords for searching. |

**5. The Implementation Plan**

This is a focused effort to build v3, with a straightforward migration path.

**Phase 1: Build the Foundation (v0.3.0)**
*   **Task 1.1: Implement the Database Schema.** Create the SQLite initialization script that builds the tables defined above.
*   **Task 1.2: Build the Core API and Logic.** Implement the internal API functions for core CRUD (Create, Read, Update, Delete) operations, connecting them to the database via the logic layer.
*   **Task 1.3: Wire the CLI to the API.** Refactor the existing CLI commands (`init`, `add`, `list`, `update`, `complete`, `status`) to be simple wrappers that call the new internal API.
*   **Task 1.4: Ensure Graceful Initialization.** The `taskwerk init` command must create the `taskwerk.db` file and the human-editable `taskwerk-rules.md`.

**Phase 2: Build the Bridge (v0.3.1)**
*   **Task 2.1: Create a Robust `import` Command.** This API-driven command will ingest Markdown files, validate them, and populate the database. It must provide clear error messages.
*   **Task 2.2: Create a Powerful `export` Command.** This will generate well-formatted, human-readable Markdown+YAML snapshots from the database, supporting filtering.
*   **Task 2.3: Add an Optional Commit Hook.** Implement an optional `--export-on-commit` hook/flag for creating versioned, human-readable snapshots in Git.

**Phase 3: Implement the "Supervisor" (v0.4.0+)**
*   **Task 3.1: Implement Advanced Git Workflow Commands.** Build the `start` and `complete` workflows, which will use the API to manage state while orchestrating Git operations, test runs, and message generation.
*   **Task 3.2: Enhance Agent Capabilities.** Build out the `agent` commands, which will leverage the queryable DB backend (via the CLI and API) for rich context.
*   **Task 3.3: Build Rich Query Commands.** Create `tree`, `stats --burndown`, and `log` commands that use the API to perform powerful SQL queries for fast, insightful reporting.
*   **Task 3.4: Implement Intelligent Context Generation.** Create the `taskwerk summary` command system for generating targeted, contextual information for agents and humans, enabling efficient task management without token explosion.

**Phase 4: Task Management Operations (v0.5.0)**
*   **Task 4.1: Mechanical Task Operations.** Implement deterministic CLI operations for task structure management: `split`, `merge`, `promote`, `demote`, `link`, `unlink` commands that work reliably offline.
*   **Task 4.2: Task Hierarchy Management.** Build subtask promotion/demotion, parent reassignment, and dependency restructuring capabilities.
*   **Task 4.3: Bulk Operations.** Implement batch operations for task metadata updates, reassignments, and bulk relationship changes.

**Phase 5: Intelligent Analysis (v0.6.0)**
*   **Task 5.1: Analysis Framework.** Build the `taskwerk analyze` command system with pluggable agent callbacks for task complexity analysis and recommendations.
*   **Task 5.2: Implementation Engine.** Create the `taskwerk implement` command that parses AI recommendations and executes mechanical operations safely.
*   **Task 5.3: Agent Integration.** Establish callback architecture for external AI services to analyze tasks and suggest improvements.

**Phase 6: Advanced Automation (v0.7.0)**
*   **Task 6.1: Planning Loops.** Implement automated analysis and improvement workflows for continuous project health monitoring.
*   **Task 6.2: Learning Systems.** Build pattern recognition to improve analysis quality over time based on project history.
*   **Task 6.3: Integration APIs.** Create MCP and webhook interfaces for seamless AI editor integration.

**Migration Path:**
The migration for the sole user (me) is simple. Once Phase 2 is complete, I will run `taskwerk import` on my existing v2 `tasks.md` and `tasks_completed.md` files to populate the new v3 database. No complex backward-compatibility logic is needed in the core tool.

**6. The "Smart Supervisor" Workflow in Action**

This architecture enables powerful, reliable automation. Consider the workflow for `taskwerk complete task-123`:

1.  **User/Agent** runs `taskwerk complete task-123 --note "Implemented with Redis cache"`.
2.  **The CLI** calls the internal `api.completeTask(123, {note: "..."})`.
3.  **The API Layer** validates the input and calls the **Core Logic**.
4.  **The Core Logic** executes the workflow:
    a. Queries the **DB** for task details and any rules in `taskwerk-rules.md`.
    b. Executes required tests. If they fail, it updates the task status to `error` in the DB and exits.
    c. On success, it calls `git` to list modified files.
    d. It updates the DB: sets `status` to `completed`, sets `completed_at`, adds the note to `task_notes`, and adds file paths to `task_files`.
    e. It generates a detailed commit message using all this information.
    f. It executes the `git commit` and can offer to merge the branch.
5.  **The CLI** reports the successful completion to the user.

**7. Intelligent Context Generation: The `taskwerk summary` System**

One of the most powerful capabilities enabled by the SQLite backend is intelligent context generation. The `taskwerk summary` command system will transform how both humans and AI agents interact with task data by providing targeted, contextual information without the token explosion of parsing large markdown files.

**Core Summary Commands:**

```bash
# Agent starting work on a task - get everything needed to understand context
taskwerk summary --agent-context TASK-042
# Returns: task details, dependency tree, related files, similar tasks, recent history

# Daily standup preparation
taskwerk summary --completed --since "yesterday" --author @me
# Returns: tasks completed with notes and file changes

# Finding related work
taskwerk summary --files-overlap TASK-042
# Returns: other tasks that touched the same files as task 042

# Debugging and problem analysis
taskwerk summary --keyword "authentication" --status error,blocked
# Returns: all auth-related problems with context

# Sprint planning
taskwerk summary --priority high --no-dependencies
# Returns: high-priority work ready to start

# Research mode for agents
taskwerk summary --search "rate limiting" --include-notes --include-history
# Returns: all mentions across tasks, notes, and timeline events
```

**Advanced Query Capabilities:**

The SQLite backend enables sophisticated relationship queries impossible with flat files:

- **Semantic connections:** Tasks that share files, keywords, or assignees
- **Critical path analysis:** Full dependency chains and blocking relationships  
- **Historical patterns:** Similar tasks, resolution approaches, time estimates
- **Impact analysis:** What tasks would be affected by changes to a specific component
- **Context preservation:** Complete audit trail of decisions and state changes

**Agent Workflow Revolution:**

Before v3 (markdown parsing):
```
Agent reads entire 5000-token tasks.md file
→ "I see 200 tasks, which should I work on?"
```

After v3 (intelligent summaries):
```bash
taskwerk summary --ready-to-start --priority high --assignee @claude
# Returns focused 200-token summary of 3 actionable tasks

taskwerk summary --agent-context TASK-051
# Returns everything needed to work on task 051 efficiently
```

This contextual intelligence is a fundamental capability that justifies the architectural shift to SQLite and positions Taskwerk as a true "smart supervisor" for development workflows.

**8. Dual-Layer Operation Architecture: Mechanical vs Intelligent**

TaskWerk v3 employs a dual-layer architecture that separates deterministic operations from AI-powered analysis, ensuring reliability while enabling intelligent automation.

**Mechanical Operations Layer (Always Available)**

Fast, reliable CLI/database operations that work offline and provide deterministic results:

```bash
# Task structure management (mechanical)
taskwerk split TASK-001 "Build API" "Build UI" "Write tests"
taskwerk merge TASK-015 TASK-016 --into "Combined authentication work"
taskwerk clone TASK-001 --as "Similar feature for mobile"

# Hierarchy management (mechanical)
taskwerk promote TASK-001.1              # Subtask → independent task
taskwerk demote TASK-005 --parent TASK-002   # Independent → subtask
taskwerk move TASK-001.1 --parent TASK-003   # Change subtask parent

# Relationship management (mechanical)
taskwerk link TASK-002 TASK-001          # Add dependency
taskwerk unlink TASK-002 TASK-001        # Remove dependency

# Metadata operations (mechanical)
taskwerk reassign TASK-001 @alice        # Change assignee
taskwerk retag TASK-001 --category bugs  # Change category
taskwerk reestimate TASK-001 2d          # Update estimate
```

**Intelligent Analysis Layer (AI-Powered)**

AI-driven operations that call external agents/services for analysis and recommendations:

```bash
# Task analysis (requires AI service)
taskwerk analyze TASK-001                # Analyze single task complexity
taskwerk analyze --project               # Analyze entire project health
taskwerk analyze TASK-001 --context "Mobile app feature"

# Recommendation implementation (AI + mechanical)
taskwerk implement "analysis-report.json" --dry-run
taskwerk implement "Split TASK-001 into API and UI components"

# Agent integration (callback architecture)
taskwerk analyze --agent "claude-3"      # Use specific AI service
taskwerk analyze --agent "http://custom-agent-url"  # Custom analysis service
```

**Architecture Benefits:**

1. **Reliability Separation**: Mechanical operations always work; AI operations can fail gracefully
2. **Composability**: AI recommendations are implemented via mechanical operations
3. **Testability**: Mechanical operations are easily tested; AI operations can be mocked
4. **Flexibility**: Users can bypass AI entirely or use full automation
5. **Offline Capability**: Core task management works without network connectivity

**Callback Architecture for AI Integration:**

```javascript
// Agent callback interface
interface TaskAnalysisAgent {
  async analyzeTask(taskId: string, context?: string): Promise<AnalysisResult>
  async analyzeProject(filters?: TaskFilter): Promise<ProjectAnalysis>
}

// Implementation recommendations format
interface AnalysisResult {
  complexity: number
  recommendations: MechanicalOperation[]
  reasoning: string
}
```

This dual-layer approach ensures TaskWerk v3 is both reliable for everyday use and intelligent when advanced analysis is needed.

**9. Conclusion**

This plan represents a consensus built on practical experience, architectural foresight, and direct AI agent feedback. By evolving to a layered, API-driven architecture with a SQLite core, we are not abandoning Taskwerk's original spirit; we are building the robust engine required to fully realize it. 

The intelligent context generation capabilities enabled by this architecture transform Taskwerk from a simple task manager into a smart development supervisor that can:
- Provide agents with precise, contextual information without token waste
- Enable sophisticated relationship queries and dependency analysis
- Maintain complete audit trails and historical context
- Scale gracefully as projects grow in complexity

This path allows us to create a powerful, reliable, and intelligent workflow supervisor that will bring much-needed structure and automation to the future of human-AI collaborative development. This is the blueprint for v3.

Feedback from Andrei:

Absolutely—Fred’s v3 doc is nearly bulletproof, but with all the feedback and past learnings, here’s a polished, **comprehensive charter** with a few additional actionable details, edge-case clarifications, and forward-looking hooks. This includes specific implementation guidance, safety notes, and a clear glossary so that you and Claude can proceed without ambiguity.

---

# **Taskwerk v3: Comprehensive Charter and Implementation Guide**

**To:** Claude, Andrei
**From:** Fred
**Date:** July 3, 2025
**Subject:** Final v3 Charter: Unified Blueprint for Agent-First, CLI-Centric Taskwerk

---

## **1. Preamble & Vision**

*(As before—concise, inspirational, and clear about “smart supervisor” role.)*

---

## **2. Core Problems & Rationale**

*(Enhanced with additional motivators based on practical experience:)*

Our collective experience using Taskwerk v0.2.x has made five things abundantly clear:

1. **Complex Relationships are Essential:** The need to split tasks into subtasks and manage dependencies is a core requirement for any meaningful project. Managing these complex relational hierarchies in flat text files is fragile and computationally expensive.
2. **The API is the True "Magic":** While hand-editing was a starting point, the real power of Taskwerk lies in its scriptable API, exposed via the CLI. The most valuable workflows—generating smart commit messages, enforcing test runs, tracking file changes—depend on fast, reliable operations.
3. **The Workflow Demands a Real Database:** To reliably guide developers and AI bots through complex workflows, we need a backend that guarantees data integrity (like unique IDs), prevents race conditions, and can be queried efficiently.
4. **CLI Has Become Dominant:** In practice, the CLI has become the primary interface, not markdown editing. This is natural evolution - as the tool becomes more powerful, direct file manipulation becomes both less necessary and more dangerous.
5. **Intelligent Context is Essential:** Large markdown files create token explosion for LLMs and poor targeting for agents. We need rich, contextual summaries and intelligent search capabilities that are impossible with flat file parsing.

**Clarifications:**
* **File Import/Export is for Interop, not Primary Use:** The DB and API are canonical; artifacts are for onboarding, snapshot, backup, and rescue.
* **CLI-First by Design:** v3 explicitly embraces CLI as the primary interface, with markdown exports serving as human-readable snapshots.

---

## **3. v3 Layered/API-Driven Architecture**

*(Diagram and narrative unchanged—already perfect.)*

**Explicit Additions:**

* **CLI and API Must Be Symmetric:** Every user-facing operation (e.g., add, start, complete, annotate, list, import/export) must be available via both CLI and a documented internal API, with clear argument validation and error reporting.
* **CLI Safety:** Always confirm destructive or potentially lossy operations (overwriting DB, mass-import, bulk delete) unless `--force` is set.

---

## **4. SQLite Schema & Data Model**

**Enhancements:**

* **Flexible Schema:**

  * *Add optional columns:* `assignee`, `estimate`, `tags`, `progress`, `error_msg`, `validation_state`.
  * *All fields except `id`, `name`, and `created_at` may be nullable.*
* **Status values:** Enumerate as `todo`, `in_progress`, `blocked`, `completed`, `archived`, `error`.
* **Notes Table:**

  * Each note links to author/agent and timestamp.
  * Notes can include “event” markers (e.g., “state change”, “imported from v2”, “error encountered”).
* **Task Audit/History Table (optional):**

  * If feasible, maintain a separate audit log of all state changes and key events (timestamped), for traceability.
* **Unique Constraints:**

  * Enforce uniqueness of task IDs and avoid accidental duplicates on import.

---

## **5. Implementation Plan and Safety Guidance**

### **Phase 1: DB/API/CLI Foundation**

* *Schema initialization:*

  * All tables and indices created if not present.
  * Version column for schema (e.g., `schema_version` in a meta table).
* *API Coverage:*

  * Full CRUD, plus dependency management, notes, files, and query for each table.
* *CLI must fail gracefully* (with descriptive errors) on all API validation errors.

### **Phase 2: Import/Export Module**

* *Import rules:*

  * **Lint** mode for validating before any mutation.
  * **Strict mapping:** Only valid fields are ingested; extra/unknown fields are reported and ignored.
  * **Conflict handling:** On duplicate IDs, prompt or auto-resolve per user flag (`--merge`, `--skip`, or `--overwrite`).
  * **Notes and warnings:** If a task is missing a required field (ID, name), reject and provide error message.
* *Export rules:*

  * Exports are deterministic, ordered, and include meta-header (timestamp, tool version, rule summary).
  * Option to export full project, filtered (by status, tag), or a single task.

### **Phase 3: Supervisor/Automation Features**

* **Supervisor routines (as described):**

  * On `start`, auto-branch, update status, annotate.
  * On `complete`, run pre-defined test suite, only allow close if passing (per `taskwerk-rules.md`), collect files changed since branch, append notes.
  * All supervisor actions log to notes/history with timestamps and agents involved.
* **Rules enforcement:**

  * CLI reads and validates rules from `taskwerk-rules.md` before any operation that modifies tasks.
  * Rules are linted at `init` and on every rule file change.
  * Agent/human distinction: Notes and event logs must always record the invoker.
* **Intelligent Context Generation:**

  * Implement `taskwerk summary` command system for targeted, contextual information delivery.
  * Enable sophisticated relationship queries (file overlap, dependency chains, keyword searches).
  * Provide agent-optimized context without token explosion.
  * Support historical analysis and pattern recognition.

---

## **6. Import/Export & Interop: Extra Details**

* **Human-editing:**

  * Encourage users to always validate with `taskwerk lint` before importing.
  * On import, provide dry-run/preview output by default; only commit on user confirmation.
* **Export-on-commit:**

  * By config, every successful DB mutation (optionally just `complete` or `merge`) triggers an artifact export.
  * Snapshots are versioned and timestamped for easy `git diff`.

---

## **7. Agent and Advanced Automation**

* **CLI is the only supported agent interface (for now).**

  * CLI can expose a `--agent` flag to annotate agent-driven actions.
* **Hooks:**

  * In future, consider webhooks or MCP API, but only via the same API functions as CLI—never bypass.
* **Task State Validation:**

  * “Smart” closeout requires all dependent tasks complete and all workflow rules met (per rules.md); else, the CLI blocks with a clear error.
* **Custom events:**

  * Allow agents or users to append arbitrary event markers (e.g., “review\_requested”, “automerge\_approved”) via CLI/API.

---

## **8. Glossary & Example YAML Export**

**Glossary (keep up to date):**

* **Task ID:** Integer (unique, never reused, never mutated)
* **Status:** One of `todo`, `in_progress`, `blocked`, `completed`, `archived`, `error`
* **Dependency:** Many-to-many relation tracked in `task_dependencies`
* **Note:** A timestamped, agent- or human-attributed message, may be a comment or a structured event
* **Artifact:** Human-readable export, always generated by CLI/API

**Sample YAML Export:**

```yaml
- id: 42
  name: "Add login endpoint"
  description: "Create REST endpoint for user login"
  status: in_progress
  priority: high
  assignee: alice
  created_at: 2025-07-03T10:23:00Z
  updated_at: 2025-07-03T14:11:23Z
  dependencies: [37, 41]
  tags: [backend, auth]
  files: ["src/auth/login.py", "tests/test_auth.py"]
  notes:
    - {author: "bob", timestamp: "2025-07-03T12:04:00Z", text: "Blocked by #41"}
    - {author: "alice", timestamp: "2025-07-03T13:40:00Z", text: "Unblocked, PR #17 merged"}
  progress: 85
  error_msg: null
  completed_at: null
```

---

## **9. Future Proofing**

* **Schema Migrations:** Every version bump of Taskwerk must check and, if needed, auto-migrate schema (safe default: add nullable columns).
* **Agent Extensions:** When adding new interfaces (MCP, web UI), *never* bypass core API.
* **Security:** In the future, consider permission fields for tasks (who can close, merge, etc).

---

## **10. Final Alignment & Call to Action**

This is the full v3 charter: API-first, DB-canonical, export/artifact-friendly, safe, robust, and automation-ready.
Nothing is left ambiguous—Claude, Andrei, you can proceed to implementation.
All rules and corner cases are codified; CLI and API must always remain in lock-step.

Let’s ship the future of agent-first, developer-centric workflow automation—*without losing the soul of Taskwerk.*

---


## **Philosophy Evolution: CLI-First by Design**

Taskwerk v3 represents an evolution in philosophy based on real-world usage patterns:

**Original Vision:** Human-editable markdown files with CLI as convenience layer  
**v3 Reality:** CLI-first workflow with markdown exports as human-readable artifacts

This shift reflects the natural evolution of how developers actually use Taskwerk:
- CLI dominates daily workflow (95%+ of operations)
- Hand-editing creates brittleness in ID management and dependencies  
- Agent automation requires reliable, atomic operations
- Context generation needs queryable, structured data

**Preserving the Spirit:**
- **Lives with your code** ✓ (SQLite database in project)
- **Git-friendly** ✓ (via quality exports and intelligent commits)
- **CLI-driven** ✓ (primary interface by design)
- **Human-readable** ✓ (rich export capabilities)
- **AI-agent compatible** ✓ (robust API with intelligent context)

The soul of Taskwerk isn't in its storage format—it's in empowering developer workflows with intelligent, reliable automation.

**Key v3 Capabilities:**
- **Intelligent context generation** via `taskwerk summary` system
- **Robust relationship management** with dependency trees and subtasks
- **Agent-optimized workflows** without token explosion
- **Sophisticated queries** for project insight and historical analysis
- **Reliable automation** with atomic operations and audit trails

---
