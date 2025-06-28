export function createTaskFile() {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return `# Project Tasks

*Last updated: ${date}*
*Current session: CLI*

## HIGH Priority

### Bug Fixes

### Features

## MEDIUM Priority

### Refactoring

### Documentation

## LOW Priority

### Testing

---
*Total: 0 active tasks*
`;
}

export function createCompletedFile() {
  return `# Completed Tasks

*Most recent tasks first*

`;
}

export function createConfigFile(tasksPath) {
  return JSON.stringify(
    {
      tasksFile: `${tasksPath}/tasks.md`,
      completedFile: `${tasksPath}/tasks_completed.md`,
      autoCommit: false,
      autoCreateBranch: true,
      defaultPriority: 'medium',
      categories: {
        bugs: 'Bug Fixes',
        features: 'Features',
        docs: 'Documentation',
        refactor: 'Refactoring',
        test: 'Testing',
      },
    },
    null,
    2
  );
}
