import { BaseTool, ToolPermissions } from '../base-tool.js';
import { readFile } from 'fs/promises';
import { resolve, relative } from 'path';
import { existsSync } from 'fs';

export class ReadFileTool extends BaseTool {
  constructor(config = {}) {
    super({
      ...config,
      description: 'Read contents of a file in the working directory',
      permissions: [ToolPermissions.READ_FILES],
    });
  }

  getParameters() {
    return {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to working directory',
        },
        encoding: {
          type: 'string',
          description: 'File encoding',
          default: 'utf-8',
        },
      },
      required: ['path'],
    };
  }

  async execute(params, _context) {
    // Resolve path relative to working directory
    const fullPath = resolve(this.workDir, params.path);

    // Security check: ensure path is within working directory
    const relativePath = relative(this.workDir, fullPath);
    if (relativePath.startsWith('..')) {
      throw new Error('Cannot read files outside working directory');
    }

    // Check if file exists
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${params.path}`);
    }

    // Read file
    try {
      const content = await readFile(fullPath, params.encoding || 'utf-8');
      return {
        path: params.path,
        content: content,
        size: content.length,
      };
    } catch (error) {
      if (error.code === 'EISDIR') {
        throw new Error(`Path is a directory: ${params.path}`);
      }
      throw error;
    }
  }
}
