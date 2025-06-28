import { mkdir, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { createTaskFile, createCompletedFile, createConfigFile } from '../core/file-templates.js';

export async function initCommand(path) {
  try {
    console.log(`Initializing taskwerk in: ${path}`);

    // Create directory if it doesn't exist
    await mkdir(path, { recursive: true });

    const tasksFile = join(path, 'tasks.md');
    const completedFile = join(path, 'tasks_completed.md');
    const configFile = join(process.cwd(), '.taskrc.json');

    // Check if files already exist
    try {
      await access(tasksFile);
      console.log('⚠️  tasks.md already exists, skipping...');
    } catch {
      await writeFile(tasksFile, createTaskFile());
      console.log('✅ Created tasks.md');
    }

    try {
      await access(completedFile);
      console.log('⚠️  tasks_completed.md already exists, skipping...');
    } catch {
      await writeFile(completedFile, createCompletedFile());
      console.log('✅ Created tasks_completed.md');
    }

    try {
      await access(configFile);
      console.log('⚠️  .taskrc.json already exists, skipping...');
    } catch {
      await writeFile(configFile, createConfigFile(path));
      console.log('✅ Created .taskrc.json');
    }

    console.log('\n🎉 TaskWerk initialized successfully!');
    console.log('\nNext steps:');
    console.log('  taskwerk add "Your first task"');
    console.log('  taskwerk list');
  } catch (error) {
    console.error('❌ Failed to initialize taskwerk:', error.message);
    process.exit(1);
  }
}
