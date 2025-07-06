
DEPRECATED
# Taskwerk V3 Common Workflows and Concepts.

Taskwerk started is a markdown based tasklist which moved well formed markdown based tasks from a human readable tasks.md to tasks_completed.md.  In V3 we started to migrate to a sqlite db so that we could have better control of tasks, task-id creation/collision avoidance, while maintaing accessability via markdown.

## Taskwerk Core 

Taskwerk is designed to be a basic CLI manager for humans and agents.  The user (human or agent) use taskflow to document work items (tasks) and then track their progress.  Each task consists of an ID, a name, and a description (optional but **highly** encourage).  

Tasks have state (open, inprogress, blocked, completed) {TODO: make surew we have **consistent** terminology in the docs and in the commands}

A highly efficient task management system cli.  Purely deterministic - no LLMs etc.  Many modern coding agents (e.g. Claude, Gemini, etc) create mini plans when asked to things but we don't really have visibility in to those miniplans and agents can get stuck in loops debugging things.  Taskwerk pulls the task visibility and planning away from the agent at a high level (the agent might still make plans to full its internal tasks) so we can make workflows more reliable.

When taskwerk is first invoked. it creates the core db (which might be after a project has started).

Taskwerk creates a folder where all tracking info is stored (sqlitedb, taskwerk config, taskwerk_rules.md, tasks.md, tasks_completed.md)

taskwerk_rules.md - this is what the LLM and taskwerk try to follow so less mistakes are made at each coding run:
Example {TODO: look at these rules and see if these are good:
```markdown
# Taskwerk Rules

# taskwerk Workflow Rules

This file defines workflow rules and development hygiene enforcement for taskwerk.
Rules are applied differently based on whether tasks are handled by AI agents or humans.

## AI Agent Workflow Rules

When AI agents (Claude Code, Cursor, etc.) take on tasks, the following rules are enforced:

### Required Workflow Phases
- **plan**: Create implementation plan and identify requirements
- **implement**: Write the actual code following project standards
- **test**: Write and run tests to ensure functionality works correctly
- **document**: Add documentation, comments, and usage examples

### Quality Gates
- **Tests Required**: Yes
- **Tests Must Pass**: Yes
- **Documentation Required**: Yes
- **Linting Required**: Yes
- **Type Checking Required**: Yes

### Commit Rules
- **Auto Commit**: Disabled
- **Require All Phases**: Yes
- **Version Bump Required**: Yes
- **Auto Version Bump**: Enabled
- **Version Bump Type**: patch
- **Auto Stage Files**: Enabled
- **All Tests Must Pass**: Required before any commit
- **Co-Authorship Required**: All commits must include proper Co-Authored-By tags for collaboration
- **Build Validation**: All targets must build successfully before commit

### Timeouts
- **Max Task Duration**: 4h
- **Phase Timeout**: 30m

## Human Workflow Rules

When humans manage tasks manually, workflow enforcement is minimal:

- **Workflow Enforcement**: Disabled
- **Required Phases**: None
- **Quality Gates**: None enforced

## Configuration

To customize these rules:

1. Edit this file directly
2. Modify `.taskrc.json` configuration
3. Use `taskwerk rules` command to manage rules interactively

## Workflow Phases

### Plan
- Create implementation plan
- Identify dependencies and requirements
- Estimate complexity and timeline

### Implement
- Write the actual code
- Follow project coding standards
- Implement error handling

### Test
- Write unit tests for new functionality
- Ensure all tests pass
- Achieve required coverage thresholds

### Document
- Add/update docstrings and comments
- Update README if needed
- Create usage examples

## Quality Gates Details

### Tests Required
When enabled, all new functionality must include tests:
- Unit tests for functions/methods
- Integration tests for complex workflows
- Edge case coverage

### Documentation Required
When enabled, all new functionality must include:
- Function/method docstrings
- Usage examples
- Updated README sections if applicable

### Linting Required
When enabled, code must pass:
- ESLint checks (JavaScript/TypeScript)
- Prettier formatting
- Project-specific linting rules

### Type Checking Required
When enabled, code must pass:
- TypeScript type checking
- JSDoc type annotations (JavaScript)
- No `any` types without justification

## Workflow Automation

taskwerk can automate version management and git operations based on workflow rules:

### Version Bumping
- **Automatic**: Version is bumped automatically when tasks are completed in AI mode
- **Types**: patch (0.1.0 → 0.1.1), minor (0.1.0 → 0.2.0), major (0.1.0 → 1.0.0)
- **Manual Override**: Use `--version-impact` flag to override automatic detection

### Auto-Staging
- **Automatic**: Changed files are automatically staged for commit
- **Scope**: Includes modified files and new untracked files
- **Manual Override**: Use `--auto-stage` flag to force staging

### Auto-Commit
- **Automatic**: Creates commits automatically after task completion
- **Message Format**: Follows conventional commit format with task details
- **Manual Override**: Use `--auto-commit` flag to force commits

### Commit Message Format

All commits must follow this format:

---
Subject line (imperative mood, < 72 chars)

Optional body explaining what and why vs. how.

Co-Authored-By: manu chatterjee <deftio@deftio.com>
Co-Authored-By: Claude <noreply@anthropic.com>


**Required elements:**
- Clear, descriptive subject line
- Standard attribution: "🤖 Generated with [Claude Code](https://claude.ai/code)"
- Co-authored tags for all contributors: manu chatterjee <deftio@deftio.com> and Claude <noreply@anthropic.com>

### Integration Commands
```bash
# Complete task with full automation
taskwerk complete TASK-001 --auto-stage --auto-commit

# Complete with specific version bump
taskwerk complete TASK-001 --version-impact minor --auto-commit

# Force automation in human mode
taskwerk complete TASK-001 --auto-stage --auto-commit --force


---

*This file was generated by taskwerk. You can edit it manually or use `taskwerk rules` to modify settings.*

```

### Other Core features
Tasks can have dependancies:
- depends_on

Tasks can have subtasks:
- each subtask is a first class citizen, really just means tasks can be recursive.  {TODO: think about subtask id naming, dependancies, dependancies for both parent and child tasks)

Tasks can be
Tasks can be spit {task-split id ==> task}

Tasks can be merged {list of tasks ==> new merged task, TODO: what are the parameters do this in a simple way}

When tasks are touched (created, updated, split, completed, etc)  Taskwerk can add notes to the task
- last updated, and the operation {TODO: keep history as list for the task?}

Summary - at anytime a summary command can provide key info about a task (completed or not), and list of tasks.
- If a list it summarizes how many tasks, provides table of the tasks, names, status, last updated-date
- summary command is used in conjunction with git operations such as making commit messages

Search - find tasks based on text search, with filters for taskIds, dates, status
- can print out detailed or compact list (like git log --oneline)



### Markdown
Full task lists and history can be exported to markdown
Tasks can be imported from markdown 

### Task Life Cycle
{TODO: show lifecycle of a task from start to finish}
{TODO: show lifecucle of several tasks in a project}


## Git  
Taskwerk integrates with git.

When we start a task, we can configure taskwerk to checkout a branch for us
When we are done with the work for that task we can have taskwerk run all the tests
(we give it the command like npm run test, or pytest, etc).
Taskwerk can make the proper git commit messages
Taskwerk will make other notes in the commit like files touched, and task start/end dates
Taskwerk will figure out if more than one task is completed to add those to the git commit.
Agent mode can manage git / help the user with git

Taskwerk can help with releases

##  AI / Agent

Taskwerk includes provisions to hookup local/remote AI agents to automate tasks

Simple llmconfig command, allows choosing of AI agents (for now assume openaiapi compatible)
- support OpenAI, Anthropic, Mistral, Meta, Deepseek, Grok, OpenRouter,  out of the box, and local backends LMStudio, Ollama
- to help config LLMS a choose function grabs models available via the provider's list api.
- user supplies the keys (if necessary)

The LLM has tool calls to all taskwerk commands along with the commands providing core workflow and help to the AI 

### ask mode
The LLM can only make non-desctructive calls (e.g. help, listing or asking about tasks or task history)

### agent mode
The LLM can take any actions within its tool scope (including git, task management, etc)
- in agent mode taskwerk will ask the user for confirmation before performing destructive actions
	- this can be overridin by setting agent-mode=auto in the llmconfig {TODO: make sure this is well documented})

Taskwerk agent mode can also be accessed if the first cli argument is quoted.

```bash
taskwerk "tell me all my tasks"  # defaults to agent mode, with all the same agent mode sub command cli switches
```

### raw mode
user can pipe data to the LLM to use it generically.
LLM can be any existing configured LLM in taskwerk. If no LLMs are available or configured it fails gracefully.

Rough example here.  Note that options for model selection and model parameters could be included
```bash
echo "my llm prompt" | taskwerk -ai_raw - - | next command
echo "my llm prompt" | taskwerk -ai_raw - -  --model=gpt4o --model-temp=0.2 | next command
```

## Planning tool (next version)
A key purpose of taskwerk is to help a use break up tasks that are too complicated in to manageable chunks.  To do this taskwerk leverages it's LLM configuration.

{TODO:  user passes a PRD or plan and taskwerk spits out a markdown file with the suggested task breakdown.  Each grouping of tasks is hiearchacal and includes key details that might not be in a PRD.  A Taskwerk plan strives for consistency so it adds things like common defs and rules.  When the user is satisfied they an import the plan in to taskwerk and it will create all the necessary tasks}



## Architure
Taskwerk is cli driven
Taskwerk uses sqlite as the default backend but command sql choices are made to be able to use other dbs if chosen in the future.
Taskwerk source tree includes tools (eg. Alembic or equivalent) to allow migrations




