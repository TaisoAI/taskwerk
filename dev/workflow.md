workflow:
  0. Pre-task verification:
     - git checkout 0.6.x && git pull
     - Verify you're on the correct base branch
  
  1. Create a feature branch for each task
     - Format: feature/TASK-XXX-brief-description
     - Example: feature/TASK-001-core-setup
     - Bump the version number (minor) for this work (e.g. 0.6.1 or 0.6.2)
  
  2. Write the code implementing the feature
     - for each build bump the 4th digit of the version e.g. 0.6.1.0, 0.6.1.1 
     - we will delete those build numbers when do a merge at the end but it helps us keep track of where we are
  
  3. Write comprehensive tests:
     - Unit tests for all new code
     - Integration tests for CLI commands
     - When tests run they delete all the data from the previous test runs cleanly
     - Test isolation with temp directories
     - Cleanup after each test run
  
  4. Ensure quality checks pass:
     - npm run lint:fix && npm run format
     - npm run build 
     - npm run test: coverage (with coverage)

  5. Ensure core commands have 100% test coverage:
     - task commands (add, list, show, update, delete, status)
     - system commands (init, status, about)
     - import/export commands
 
  
  6. Update documentation if needed:
     - README.md for user-facing changes
     - API docs for interface changes
     - CHANGELOG.md with version entry
     - Each command implemented (e.g. task, init, etc has sub command help and examples)
  
  7. Write commit message with both authors:
     TASK-XXX: Brief description

     - Detailed change 1  
     - Detailed change 2
     - ..

     Co-authored-by: manu <deftio@deftio.com>
     Co-authored-by: Claude <claude@anthropic.com>
  
  8. Merge back to 0.6.x:
     - Use merge commit to preserve history: git merge --no-ff feature/TASK-XXX
     - Resolve any conflicts
  

