import { readFile, access } from 'fs/promises';
import { join } from 'path';

const DEFAULT_CONFIG = {
  tasksFile: 'tasks/tasks.md',
  completedFile: 'tasks/tasks_completed.md',
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
};

export async function loadConfig() {
  const configPath = join(process.cwd(), '.taskrc.json');

  try {
    await access(configPath);
    const content = await readFile(configPath, 'utf8');
    const userConfig = JSON.parse(content);

    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return DEFAULT_CONFIG;
    }
    throw new Error(`Failed to load config: ${error.message}`);
  }
}

export function validateConfig(config) {
  const required = ['tasksFile', 'completedFile'];

  for (const field of required) {
    if (!config[field]) {
      throw new Error(`Missing required config field: ${field}`);
    }
  }

  const validPriorities = ['high', 'medium', 'low'];
  if (!validPriorities.includes(config.defaultPriority)) {
    throw new Error(`Invalid defaultPriority: ${config.defaultPriority}`);
  }

  return true;
}
