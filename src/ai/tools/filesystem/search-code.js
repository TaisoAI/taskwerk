import { BaseTool } from '../base-tool.js';
import { execSync } from 'child_process';
import { join } from 'path';

/**
 * Tool for searching code patterns in the project
 */
export class SearchCodeTool extends BaseTool {
  constructor(config = {}) {
    super(config);
    this.name = 'search_code';
    this.description = 'Search for code patterns in the project using grep';
    this.permissions = ['read_files'];
  }

  getParameters() {
    return {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The pattern to search for (supports regex)'
        },
        path: {
          type: 'string',
          description: 'Optional path to search in (relative to working directory)',
          default: '.'
        },
        filePattern: {
          type: 'string', 
          description: 'Optional file pattern to filter (e.g., "*.js")',
          default: '*'
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Whether the search should be case sensitive',
          default: true
        },
        maxResults: {
          type: 'integer',
          description: 'Maximum number of results to return',
          default: 20
        }
      },
      required: ['pattern']
    };
  }

  async execute(params, _context) {
    const { pattern, path = '.', filePattern = '*', caseSensitive = true, maxResults = 20 } = params;
    
    try {
      // Validate path is within working directory
      const fullPath = join(this.workDir, path);
      if (!fullPath.startsWith(this.workDir)) {
        throw new Error('Access denied: path must be within working directory');
      }

      // Build grep command
      const flags = caseSensitive ? '' : '-i';
      const includeFlag = filePattern !== '*' ? `--include="${filePattern}"` : '';
      
      // Use grep to search (cross-platform alternative would use a Node.js library)
      const command = `grep ${flags} -r -n ${includeFlag} "${pattern}" "${fullPath}" | head -${maxResults}`;
      
      try {
        const output = execSync(command, { 
          encoding: 'utf8',
          cwd: this.workDir,
          maxBuffer: 1024 * 1024 // 1MB buffer
        });
        
        // Parse grep output
        const matches = output.trim().split('\n').filter(Boolean).map(line => {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            return {
              file: match[1].replace(fullPath + '/', ''),
              line: parseInt(match[2]),
              content: match[3].trim()
            };
          }
          return null;
        }).filter(Boolean);

        return {
          pattern,
          path,
          matchCount: matches.length,
          matches,
          truncated: matches.length >= maxResults
        };
      } catch (error) {
        // grep returns non-zero exit code when no matches found
        if (error.status === 1) {
          return {
            pattern,
            path,
            matchCount: 0,
            matches: []
          };
        }
        throw error;
      }
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  requiresPermission(_params) {
    // This is a read-only operation
    return null;
  }
}