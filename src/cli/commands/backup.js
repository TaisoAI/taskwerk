/**
 * Backup Command
 * 
 * @description Create and restore backups
 * @module taskwerk/cli/commands/backup
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskwerkAPI } from '../../core/api.js';
import { initializeStorage } from '../../storage/index.js';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

/**
 * Creates the backup command
 * @returns {Command} The backup command
 */
export function makeBackupCommand() {
  const backupCommand = new Command('backup')
    .description('Backup and restore tasks');

  // Create backup
  backupCommand
    .command('create [path]')
    .description('Create a backup')
    .option('--compress', 'Compress backup (requires tar)')
    .action(async (backupPath, options) => {
      await handleCreateBackup(backupPath, options);
    });

  // Restore backup
  backupCommand
    .command('restore <path>')
    .description('Restore from backup')
    .option('-m, --mode <mode>', 'Restore mode: merge, replace', 'replace')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (backupPath, options) => {
      await handleRestoreBackup(backupPath, options);
    });

  // List backups
  backupCommand
    .command('list [path]')
    .description('List available backups')
    .action(async (searchPath) => {
      await handleListBackups(searchPath);
    });

  return backupCommand;
}

/**
 * Handle creating a backup
 */
async function handleCreateBackup(backupPath, options) {
  try {
    // Initialize storage and API
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Default to home directory if no path specified
    if (!backupPath) {
      backupPath = path.join(os.homedir(), '.taskwerk-backups');
    }

    // Ensure backup directory exists
    await fs.mkdir(backupPath, { recursive: true });

    console.log(chalk.gray('Creating backup...'));

    // Create backup
    const result = await api.importExport.createBackup(backupPath);

    console.log(chalk.green(`✓ Backup created successfully`));
    console.log(chalk.gray(`  Location: ${result.path}`));
    console.log(chalk.gray(`  Tasks: ${result.stats.tasks}`));
    console.log(chalk.gray(`  Size: ${formatFileSize(result.stats.size)}`));
    console.log(chalk.gray(`  Version: ${result.taskwerk_version}`));

    // Compress if requested
    if (options.compress) {
      await compressBackup(result.path);
    }

    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Handle restoring from backup
 */
async function handleRestoreBackup(backupPath, options) {
  try {
    // Check if backup exists
    const stats = await fs.stat(backupPath);
    if (!stats.isDirectory()) {
      // Check if it's a compressed backup
      if (backupPath.endsWith('.tar.gz')) {
        console.log(chalk.gray('Extracting compressed backup...'));
        backupPath = await extractBackup(backupPath);
      } else {
        console.error(chalk.red('Error: Backup path must be a directory'));
        process.exit(1);
      }
    }

    // Read backup info
    const backupInfoPath = path.join(backupPath, 'backup.json');
    const backupInfo = JSON.parse(await fs.readFile(backupInfoPath, 'utf8'));

    // Initialize storage and API
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Get current stats
    const currentStats = await getTaskStats(api);

    // Show backup info
    console.log(chalk.bold('Backup Information:'));
    console.log(`  Created: ${new Date(backupInfo.created_at).toLocaleString()}`);
    console.log(`  Version: ${backupInfo.taskwerk_version}`);
    console.log(`  Tasks: ${backupInfo.stats.tasks}`);
    console.log();
    console.log(chalk.bold('Current Database:'));
    console.log(`  Tasks: ${currentStats.total}`);
    console.log(`  Mode: ${options.mode}`);

    // Confirm unless --yes
    if (!options.yes) {
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const confirmed = await new Promise((resolve) => {
        rl.question('\nProceed with restore? (y/N) ', (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });

      if (!confirmed) {
        console.log('Restore cancelled');
        storage.close();
        process.exit(0);
      }
    }

    // Perform restore
    console.log(chalk.gray('\nRestoring...'));
    const result = await api.importExport.restoreBackup(backupPath, {
      mode: options.mode
    });

    console.log(chalk.green('\n✓ Restore completed'));
    console.log(chalk.gray(`  Imported: ${result.imported} task(s)`));
    console.log(chalk.gray(`  Skipped: ${result.skipped} task(s)`));
    
    if (result.errors.length > 0) {
      console.log(chalk.red(`  Errors: ${result.errors.length}`));
    }

    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Handle listing backups
 */
async function handleListBackups(searchPath) {
  try {
    // Default to home directory
    if (!searchPath) {
      searchPath = path.join(os.homedir(), '.taskwerk-backups');
    }

    // Check if directory exists
    try {
      await fs.access(searchPath);
    } catch {
      console.log(chalk.gray('No backups found'));
      return;
    }

    // Find all backup directories
    const entries = await fs.readdir(searchPath, { withFileTypes: true });
    const backups = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('taskwerk-backup-')) {
        const backupPath = path.join(searchPath, entry.name);
        try {
          const info = JSON.parse(
            await fs.readFile(path.join(backupPath, 'backup.json'), 'utf8')
          );
          backups.push({
            name: entry.name,
            path: backupPath,
            ...info
          });
        } catch {
          // Invalid backup directory
        }
      } else if (entry.name.endsWith('.tar.gz')) {
        // Compressed backup
        backups.push({
          name: entry.name,
          path: path.join(searchPath, entry.name),
          compressed: true
        });
      }
    }

    if (backups.length === 0) {
      console.log(chalk.gray('No backups found'));
      return;
    }

    // Sort by date (newest first)
    backups.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    });

    // Display backups
    console.log(chalk.bold(`Found ${backups.length} backup(s):\n`));
    
    for (const backup of backups) {
      console.log(chalk.bold(backup.name));
      if (backup.compressed) {
        console.log(chalk.gray('  (Compressed backup)'));
      } else {
        console.log(chalk.gray(`  Created: ${new Date(backup.created_at).toLocaleString()}`));
        console.log(chalk.gray(`  Version: ${backup.taskwerk_version}`));
        console.log(chalk.gray(`  Tasks: ${backup.stats.tasks}`));
      }
      console.log();
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Compress backup directory
 */
async function compressBackup(backupPath) {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const backupName = path.basename(backupPath);
  const parentDir = path.dirname(backupPath);
  const tarFile = `${backupPath}.tar.gz`;

  try {
    console.log(chalk.gray('Compressing backup...'));
    await execAsync(`tar -czf "${tarFile}" -C "${parentDir}" "${backupName}"`, {
      cwd: parentDir
    });
    
    // Remove original directory
    await fs.rm(backupPath, { recursive: true });
    
    console.log(chalk.gray(`  Compressed to: ${tarFile}`));
  } catch (err) {
    console.warn(chalk.yellow('Warning: Failed to compress backup'));
    console.warn(chalk.gray(`  ${err.message}`));
  }
}

/**
 * Extract compressed backup
 */
async function extractBackup(tarFile) {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const parentDir = path.dirname(tarFile);
  const extractDir = path.join(parentDir, 'temp-extract-' + Date.now());

  try {
    await fs.mkdir(extractDir, { recursive: true });
    await execAsync(`tar -xzf "${tarFile}" -C "${extractDir}"`);
    
    // Find the backup directory
    const entries = await fs.readdir(extractDir);
    const backupDir = entries.find(e => e.startsWith('taskwerk-backup-'));
    
    if (!backupDir) {
      throw new Error('Invalid backup archive');
    }
    
    return path.join(extractDir, backupDir);
  } catch (err) {
    throw new Error(`Failed to extract backup: ${err.message}`);
  }
}

/**
 * Get task statistics
 */
async function getTaskStats(api) {
  const allTasks = await api.listTasks({ include_archived: true });
  return {
    total: allTasks.length
  };
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}