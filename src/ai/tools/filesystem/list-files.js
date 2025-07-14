import { BaseTool, ToolPermissions } from '../base-tool.js';
import { readdir, stat } from 'fs/promises';
import { join, resolve, relative } from 'path';

export class ListFilesTool extends BaseTool {
  constructor(config = {}) {
    super({
      ...config,
      description: 'List files and directories in the working directory',
      permissions: [ToolPermissions.READ_FILES]
    });
  }

  getParameters() {
    return {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path relative to working directory',
          default: '.'
        },
        recursive: {
          type: 'boolean',
          description: 'List files recursively',
          default: false
        },
        include_hidden: {
          type: 'boolean',
          description: 'Include hidden files (starting with .)',
          default: false
        },
        pattern: {
          type: 'string',
          description: 'Filter pattern (glob-like)'
        }
      }
    };
  }

  async execute(params, context) {
    const targetPath = params.path || '.';
    const fullPath = resolve(this.workDir, targetPath);
    
    // Security check
    const relativePath = relative(this.workDir, fullPath);
    if (relativePath.startsWith('..')) {
      throw new Error('Cannot list files outside working directory');
    }

    const results = await this.listDirectory(fullPath, params);
    
    // Make paths relative to working directory
    return results.map(item => ({
      ...item,
      path: relative(this.workDir, item.path)
    }));
  }

  async listDirectory(dirPath, options, results = []) {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip hidden files if not requested
        if (!options.include_hidden && entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = join(dirPath, entry.name);
        const stats = await stat(fullPath);
        
        // Apply pattern filter if provided
        if (options.pattern && !this.matchPattern(entry.name, options.pattern)) {
          continue;
        }

        results.push({
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString()
        });

        // Recurse into directories if requested
        if (options.recursive && entry.isDirectory()) {
          await this.listDirectory(fullPath, options, results);
        }
      }
    } catch (error) {
      if (error.code === 'ENOTDIR') {
        throw new Error('Path is not a directory');
      }
      throw error;
    }

    return results;
  }

  matchPattern(name, pattern) {
    // Simple glob-like pattern matching
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(name);
  }
}