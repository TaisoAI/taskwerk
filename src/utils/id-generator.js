export function generateTaskId(existingTasks) {
  const existingIds = existingTasks
    .map(task => task.id)
    .filter(id => id.startsWith('TASK-'))
    .map(id => parseInt(id.split('-')[1]))
    .filter(num => !isNaN(num))
    .sort((a, b) => a - b);

  let nextId = 1;

  // Find the next available ID (handles gaps in sequence)
  for (const id of existingIds) {
    if (id === nextId) {
      nextId++;
    } else if (id > nextId) {
      break;
    }
  }

  return `TASK-${nextId.toString().padStart(3, '0')}`;
}

export function parseTaskId(taskId) {
  const match = taskId.match(/^([A-Z]+)-(\d+)$/);

  if (!match) {
    throw new Error(`Invalid task ID format: ${taskId}`);
  }

  const [, prefix, number] = match;

  return {
    prefix,
    number: parseInt(number),
    full: taskId,
  };
}

export function isValidTaskId(taskId) {
  return /^[A-Z]+-\d+$/.test(taskId);
}
