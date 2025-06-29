# Project Tasks

*Last updated: 06/27/2025*
*Current session: CLI*
*Next ID: TASK-074*

## HIGH Priority

- [x] **TASK-042** all subcommands should have useful help so someone can understand how to use them and what they actually do.
- [ ] **TASK-033** the npm run build needs to build all of taskwerk in to a single minified js
- [ ] **TASK-045** taskwerk commit should have a companion commands to stage files and it should make commit messages based on all the tasks that have been completed.  Propose a workflow for how git commits interact with taskwerk and make a proper flow of taskwerk commands
- [ ] **TASK-053** Make TaskWerk npm installable with bin directory and compact alias 'twrk'
- [ ] **TASK-063** Remove confusing human vs AI mode distinction - implement unified workflow for everyone
- [ ] **TASK-064** Audit all taskwerk commands to remove unexpected side effects and align with unified workflow
- [>] **TASK-069** Add comprehensive test coverage for Git safety behaviors in commit and branch commands
### Bug Fixes

- [x] **TASK-023** Improve LLM error messages with setup guidance when no API key configured
- [x] **TASK-040** Fix taskwerk ask vs agent - ask should be questions only, agent should perform actions
### Features

- [x] **TASK-029** Improve help system to work well with or without LLM integration
- [ ] **TASK-052** Enhance workflow rules validation to actually check for test files and fail completion if tests are missing/failing
## MEDIUM Priority

- [ ] **TASK-011** Write comprehensive documentation for all features
- [ ] **TASK-025** Update default model choices to current 2025 options (GPT-4o, Claude-3.5-Sonnet, etc)
- [ ] **TASK-031** add test coverage to npm run test
- [ ] **TASK-034** for many commands, such as stats or status the output at the cli is markdown.  Instead it should be gracefully formatted for a cli output.  But all commands should have the option to output as md or json (for automation).
- [ ] **TASK-035** make sure taskwerk commands are pipeable
- [ ] **TASK-039** when taskwerk takes on a task it should also have taskwerk rules file, perhaps taskwerk-rules.md or part of the the config that instructs taskwerk about what level of detail to put in the tasks-completed.md file for that task.  Level of details include what files were touched, how the code was changed, side effects, and any other notes.  This info can be used in git commit messages.  
- [ ] **TASK-043** The task description.
- [ ] **TASK-046** Task description
- [ ] **TASK-047** taskwerk simple llm command - if you run taskwerk like this taskwerk 'this is a task for taskwerk' or with double quotes it will invoke the llm in ask mode.  if you append --agent afterwards it will invoke taskwerk in agent mode.
- [ ] **TASK-048** the taskwork date time stamps should always be YYYY-MM-DD-HH-MM-SS so its not confused with different international date formats
- [ ] **TASK-054** taskwerk should support sub tasks? (make plan to see if this make sense before coding)
- [ ] **TASK-055** taskwerk interactive cli mode -- Instead of typing in each command at the terminal, the user can enter cli mode such as taskwerk cli.  All the basic taskwerk commands become slash commands /list /add etc.  It should have syntax highlighting so the user can clear see what taskwerk is doing and what they type.  if they don't type in anything taskwerk will be in agent mode by default - so it takes free form responses.  Note that cli mode should be able to toggle between agent mode and ask mode via a slash command (think about what this should be.   perhaps /toggle-mode agent or /toggle-mode ask.
- [ ] **TASK-056** enable optional logging -- taskwerk should have an option to log all commands and responses to separate log file.  There should be options to log all or some commands such as logging --off (no logging), logggin --all (every command input and output is appended to a log with timestamp), and then specific filters could be set like loigging ai commands etc.  logging could be part of the config file and stored there.
- [ ] **TASK-058** Update dev/taskwerk-overview.md to reflect current v0.1.6 implementation and remove outdated features
- [ ] **TASK-067** Update tests to reflect simplified command behavior - remove AI mode and auto-workflow test expectations
### Refactoring

- [ ] **TASK-027** Review usability and workflows for TaskWerk CLI tool
### Documentation

- [ ] **TASK-028** Audit tasks.md and tasks-completed.md for human readability - clean markdown, no emojis
## LOW Priority

- [ ] **TASK-012** Create animated GIF demo for README.md showing TaskWerk in action
- [ ] **TASK-013** Add ASCII banner to taskwerk init command
- [ ] **TASK-026** Implement built-in local model support (SmolLM2/Phi-4) as specified in integration task
- [ ] **TASK-059** Create alternative to pkg for platform-specific executables (Linux, macOS, Windows)
### Testing

---
*Total: 0 active tasks*
