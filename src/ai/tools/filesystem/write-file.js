import { BaseTool, ToolPermissions } from '../base-tool.js';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { resolve, relative, dirname } from 'path';
import { existsSync } from 'fs';

export class WriteFileTool extends BaseTool {
  constructor(config = {}) {
    super({
      ...config,
      description: 'Write or create a file in the working directory',
      permissions: [ToolPermissions.WRITE_FILES]
    });
  }

  getParameters() {
    return {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to working directory'
        },
        content: {
          type: 'string',
          description: 'Content to write to the file'
        },
        encoding: {
          type: 'string',
          description: 'File encoding',
          default: 'utf-8'
        },
        mode: {
          type: 'string',
          enum: ['overwrite', 'append', 'create'],
          description: 'Write mode',
          default: 'overwrite'
        }
      },
      required: ['path', 'content']
    };
  }

  async execute(params, _context) {
    // Resolve path relative to working directory
    const fullPath = resolve(this.workDir, params.path);
    
    // Security check: ensure path is within working directory
    const relativePath = relative(this.workDir, fullPath);
    if (relativePath.startsWith('..')) {
      throw new Error('Cannot write files outside working directory');
    }

    // Check mode restrictions
    if (params.mode === 'create' && existsSync(fullPath)) {
      throw new Error(`File already exists: ${params.path}`);
    }

    // Create directory if needed
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Write file
    if (params.mode === 'append') {
      const existing = existsSync(fullPath) ? await readFile(fullPath, 'utf-8') : '';
      await writeFile(fullPath, existing + params.content, params.encoding || 'utf-8');
    } else {
      await writeFile(fullPath, params.content, params.encoding || 'utf-8');
    }
    
    return {
      path: params.path,
      written: params.content.length,
      mode: params.mode || 'overwrite'
    };
  }

  requiresPermission(params) {
    const action = existsSync(resolve(this.workDir, params.path)) 
      ? `Overwrite file: ${params.path}`
      : `Create file: ${params.path}`;
    return action;
  }
}