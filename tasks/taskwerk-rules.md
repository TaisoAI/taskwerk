# Taskwerk v3 Implementation Rules

## Development Standards

### Code Quality
- [ ] All functions have JSDoc comments
- [ ] Use async/await, not callbacks
- [ ] Handle errors with try/catch
- [ ] Use custom error classes
- [ ] No console.log in production code

### Testing Requirements
- [ ] Write tests before implementation (TDD)
- [ ] Minimum 80% code coverage
- [ ] Test both success and error cases
- [ ] Integration tests for all CLI commands
- [ ] Use Node.js built-in test runner

### Before Starting a Task
- [ ] Read the task description completely
- [ ] Check dependencies are completed
- [ ] Review related code in implementation guide
- [ ] Create feature branch: feature/TASK-XXX

### During Implementation
- [ ] Follow patterns from v3-implementation-guide.md
- [ ] Update task progress regularly
- [ ] Commit frequently with clear messages
- [ ] Include task ID in commits: "TASK-XXX: description"

### Before Completing a Task
- [ ] All acceptance criteria met
- [ ] All tests pass
- [ ] No linting errors
- [ ] Code follows project style
- [ ] Documentation updated if needed

### Git Workflow
- [ ] Work in feature branches
- [ ] Never commit directly to main
- [ ] Squash commits before merging
- [ ] Delete feature branch after merge

### Architecture Rules
- [ ] CLI calls API, never database directly
- [ ] API returns data, not formatted strings
- [ ] All database access through storage layer
- [ ] Subcommands for all operations
- [ ] State transitions must be valid

### Specific v3 Guidelines
- [ ] Use 'active' not 'in_progress' for status
- [ ] Task IDs format: TASK-XXX (minimum 3 digits)
- [ ] Notes use YAML frontmatter format
- [ ] Dual notes approach: field + table
- [ ] Export must preserve all data

## For AI Agents

When implementing tasks:
1. Start with the simplest implementation that works
2. Follow existing patterns from the implementation guide
3. Test as you go
4. Ask for clarification if requirements are unclear
5. Update task status and notes frequently

Remember: The implementation guide has most answers. Check there first!