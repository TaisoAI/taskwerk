/**
 * Task Note Command
 * 
 * @description Manage task notes with YAML frontmatter
 * @module taskwerk/cli/commands/task/note
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskwerkAPI } from '../../../core/api.js';
import { initializeStorage } from '../../../storage/index.js';
import { NoteType } from '../../../core/constants.js';
import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Creates the task note command
 * @returns {Command} The note command
 */
export function makeNoteCommand() {
  const noteCommand = new Command('note')
    .description('Manage task notes');

  // Add subcommands
  noteCommand
    .command('add <taskId>')
    .description('Add a note to a task')
    .option('-m, --message <note>', 'Note content')
    .option('-t, --type <type>', 'Note type (comment, plan, update, block, complete)', 'comment')
    .option('-e, --edit', 'Open editor for note')
    .option('--metadata <json>', 'Additional metadata as JSON')
    .action(async (taskId, options) => {
      await handleAddNote(taskId, options);
    });

  noteCommand
    .command('list <taskId>')
    .description('List notes for a task')
    .option('-t, --type <type>', 'Filter by note type')
    .option('--since <date>', 'Show notes since date')
    .option('--until <date>', 'Show notes until date')
    .option('-r, --reverse', 'Show newest first')
    .option('--format <format>', 'Output format: text, json, yaml', 'text')
    .action(async (taskId, options) => {
      await handleListNotes(taskId, options);
    });

  noteCommand
    .command('show <noteId>')
    .description('Show a specific note')
    .option('--format <format>', 'Output format: text, json, yaml', 'text')
    .action(async (noteId, options) => {
      await handleShowNote(noteId, options);
    });

  noteCommand
    .command('edit <noteId>')
    .description('Edit an existing note')
    .option('-m, --message <note>', 'New note content')
    .option('-e, --editor', 'Open in editor')
    .action(async (noteId, options) => {
      await handleEditNote(noteId, options);
    });

  noteCommand
    .command('delete <noteId>')
    .description('Delete a note')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (noteId, options) => {
      await handleDeleteNote(noteId, options);
    });

  noteCommand
    .command('search <query>')
    .description('Search notes')
    .option('-t, --task <taskId>', 'Search within specific task')
    .option('-l, --limit <n>', 'Limit results', parseInt, 10)
    .action(async (query, options) => {
      await handleSearchNotes(query, options);
    });

  return noteCommand;
}

/**
 * Handle adding a note
 */
async function handleAddNote(taskId, options) {
  try {
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Get note content
    let content;
    if (options.edit) {
      content = await openInEditor('');
    } else if (options.message) {
      content = options.message;
    } else {
      // Read from stdin or prompt
      content = await readMultilineInput('Enter note (Ctrl+D to finish):');
    }

    if (!content.trim()) {
      console.error(chalk.red('Error: Note content cannot be empty'));
      process.exit(1);
    }

    // Prepare note data
    const noteData = {
      content,
      metadata: {
        type: options.type
      }
    };

    // Add custom metadata if provided
    if (options.metadata) {
      try {
        const customMetadata = JSON.parse(options.metadata);
        Object.assign(noteData.metadata, customMetadata);
      } catch (err) {
        console.error(chalk.red('Error: Invalid JSON for metadata'));
        process.exit(1);
      }
    }

    // Add note
    const note = await api.notes.addNote(taskId, noteData);

    console.log(chalk.green(`✓ Added note to task ${chalk.bold(taskId)}`));
    console.log(chalk.gray(`  Note ID: ${note.id}`));
    console.log(chalk.gray(`  Type: ${note.metadata.type}`));

    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Handle listing notes
 */
async function handleListNotes(taskId, options) {
  try {
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Get notes
    const notes = await api.notes.getTaskNotes(taskId, {
      type: options.type,
      since: options.since,
      until: options.until,
      reverse: options.reverse
    });

    if (notes.length === 0) {
      console.log(chalk.gray('No notes found'));
      storage.close();
      return;
    }

    // Display notes
    switch (options.format) {
      case 'json':
        console.log(JSON.stringify(notes, null, 2));
        break;
      case 'yaml':
        for (const note of notes) {
          console.log(chalk.gray('---'));
          console.log(formatNoteAsYaml(note));
        }
        break;
      default:
        displayNotes(notes);
    }

    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Handle showing a note
 */
async function handleShowNote(noteId, options) {
  try {
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    const note = await api.notes.getNote(parseInt(noteId));
    if (!note) {
      console.error(chalk.red(`Error: Note ${noteId} not found`));
      process.exit(1);
    }

    switch (options.format) {
      case 'json':
        console.log(JSON.stringify(note, null, 2));
        break;
      case 'yaml':
        console.log(formatNoteAsYaml(note));
        break;
      default:
        displayNote(note);
    }

    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Handle editing a note
 */
async function handleEditNote(noteId, options) {
  try {
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Get existing note
    const note = await api.notes.getNote(parseInt(noteId));
    if (!note) {
      console.error(chalk.red(`Error: Note ${noteId} not found`));
      process.exit(1);
    }

    // Get new content
    let newContent;
    if (options.editor) {
      newContent = await openInEditor(note.content);
    } else if (options.message) {
      newContent = options.message;
    } else {
      console.log(chalk.gray('Current content:'));
      console.log(note.content);
      console.log();
      newContent = await readMultilineInput('Enter new content (Ctrl+D to finish):');
    }

    // Update note
    const updated = await api.notes.updateNote(parseInt(noteId), newContent);

    console.log(chalk.green(`✓ Updated note ${noteId}`));

    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Handle deleting a note
 */
async function handleDeleteNote(noteId, options) {
  try {
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    // Get note to confirm
    const note = await api.notes.getNote(parseInt(noteId));
    if (!note) {
      console.error(chalk.red(`Error: Note ${noteId} not found`));
      process.exit(1);
    }

    // Show what will be deleted
    console.log(`About to delete note ${noteId}:`);
    console.log(chalk.gray(note.content.substring(0, 100) + (note.content.length > 100 ? '...' : '')));

    // Confirm unless --yes
    if (!options.yes) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const confirmed = await new Promise((resolve) => {
        rl.question('\nAre you sure? (y/N) ', (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });

      if (!confirmed) {
        console.log('Cancelled');
        storage.close();
        process.exit(0);
      }
    }

    // Delete note
    await api.notes.deleteNote(parseInt(noteId));

    console.log(chalk.green(`✓ Deleted note ${noteId}`));

    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Handle searching notes
 */
async function handleSearchNotes(query, options) {
  try {
    const storage = await initializeStorage();
    const api = new TaskwerkAPI({ database: storage.db });

    const results = await api.notes.searchNotes(query, {
      taskId: options.task,
      limit: options.limit
    });

    if (results.length === 0) {
      console.log(chalk.gray('No notes found'));
      storage.close();
      return;
    }

    console.log(chalk.bold(`Found ${results.length} note${results.length !== 1 ? 's' : ''}`));
    console.log(chalk.gray('─'.repeat(60)));

    for (const note of results) {
      console.log(`${chalk.bold(note.task_string_id)} - Note ${note.id} (${formatNoteType(note.type)})`);
      console.log(chalk.gray(`Created: ${new Date(note.created_at).toLocaleString()}`));
      
      // Show excerpt
      const excerpt = note.content.substring(0, 100).replace(/\n/g, ' ');
      console.log(excerpt + (note.content.length > 100 ? '...' : ''));
      console.log();
    }

    storage.close();
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Display notes in text format
 */
function displayNotes(notes) {
  for (const note of notes) {
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`${chalk.bold(`Note ${note.id}`)} - ${formatNoteType(note.type)}`);
    console.log(chalk.gray(`Created: ${new Date(note.created_at).toLocaleString()}`));
    
    if (Object.keys(note.metadata).length > 3) { // More than default metadata
      console.log(chalk.gray('Metadata:'));
      for (const [key, value] of Object.entries(note.metadata)) {
        if (!['created_at', 'created_by', 'type'].includes(key)) {
          console.log(chalk.gray(`  ${key}: ${value}`));
        }
      }
    }
    
    console.log();
    console.log(note.content);
  }
  
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.gray(`${notes.length} note${notes.length !== 1 ? 's' : ''}`));
}

/**
 * Display a single note
 */
function displayNote(note) {
  console.log(chalk.bold(`Note ${note.id}`));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`${chalk.gray('Type:')}       ${formatNoteType(note.type)}`);
  console.log(`${chalk.gray('Task ID:')}    ${note.task_id}`);
  console.log(`${chalk.gray('Created:')}    ${new Date(note.created_at).toLocaleString()}`);
  console.log(`${chalk.gray('Created by:')} ${note.created_by}`);
  
  if (Object.keys(note.metadata).length > 3) {
    console.log(chalk.gray('\nMetadata:'));
    for (const [key, value] of Object.entries(note.metadata)) {
      if (!['created_at', 'created_by', 'type'].includes(key)) {
        console.log(`  ${chalk.gray(key + ':')} ${value}`);
      }
    }
  }
  
  console.log(chalk.gray('\nContent:'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(note.content);
}

/**
 * Format note as YAML
 */
function formatNoteAsYaml(note) {
  const yaml = [];
  yaml.push(`id: ${note.id}`);
  yaml.push(`task_id: ${note.task_id}`);
  yaml.push(`type: ${note.type}`);
  yaml.push(`created_at: ${note.created_at}`);
  yaml.push(`created_by: ${note.created_by}`);
  
  if (Object.keys(note.metadata).length > 3) {
    yaml.push('metadata:');
    for (const [key, value] of Object.entries(note.metadata)) {
      if (!['created_at', 'created_by', 'type'].includes(key)) {
        yaml.push(`  ${key}: ${value}`);
      }
    }
  }
  
  yaml.push('content: |');
  note.content.split('\n').forEach(line => {
    yaml.push(`  ${line}`);
  });
  
  return yaml.join('\n');
}

/**
 * Format note type for display
 */
function formatNoteType(type) {
  const typeColors = {
    comment: chalk.gray,
    plan: chalk.blue,
    update: chalk.yellow,
    block: chalk.red,
    complete: chalk.green
  };
  
  const color = typeColors[type] || chalk.white;
  return color(type);
}

/**
 * Read multiline input from stdin
 */
async function readMultilineInput(prompt) {
  console.log(chalk.gray(prompt));
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  const lines = [];
  
  return new Promise((resolve) => {
    rl.on('line', (line) => {
      lines.push(line);
    });
    
    rl.on('close', () => {
      resolve(lines.join('\n'));
    });
  });
}

/**
 * Open content in editor
 */
async function openInEditor(content) {
  const editor = process.env.EDITOR || 'nano';
  const tmpFile = path.join('/tmp', `taskwerk-note-${Date.now()}.md`);
  
  try {
    // Write content to temp file
    await fs.writeFile(tmpFile, content);
    
    // Open in editor
    execSync(`${editor} ${tmpFile}`, { stdio: 'inherit' });
    
    // Read back
    const edited = await fs.readFile(tmpFile, 'utf8');
    
    // Clean up
    await fs.unlink(tmpFile);
    
    return edited;
  } catch (err) {
    throw new Error(`Failed to open editor: ${err.message}`);
  }
}