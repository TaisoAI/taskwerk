/**
 * Configuration schema definition
 */
export const CONFIG_SCHEMA = {
  // General settings
  general: {
    type: 'object',
    properties: {
      defaultPriority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
        description: 'Default priority for new tasks',
      },
      defaultStatus: {
        type: 'string',
        enum: ['todo', 'in-progress', 'blocked', 'done'],
        default: 'todo',
        description: 'Default status for new tasks',
      },
      taskIdPrefix: {
        type: 'string',
        default: 'TASK',
        pattern: '^[A-Z]+$',
        description: 'Prefix for generated task IDs',
      },
      dateFormat: {
        type: 'string',
        default: 'YYYY-MM-DD',
        description: 'Date format for display',
      },
    },
    required: [],
  },

  // Database settings
  database: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        default: '~/.taskwerk/taskwerk.db',
        description: 'Path to the SQLite database file',
      },
      backupEnabled: {
        type: 'boolean',
        default: true,
        description: 'Enable automatic database backups',
      },
      backupInterval: {
        type: 'string',
        default: 'daily',
        enum: ['hourly', 'daily', 'weekly', 'never'],
        description: 'How often to backup the database',
      },
      backupCount: {
        type: 'integer',
        default: 7,
        minimum: 1,
        maximum: 365,
        description: 'Number of backups to keep',
      },
    },
    required: [],
  },

  // Git integration settings
  git: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        default: true,
        description: 'Enable git integration features',
      },
      branchPrefix: {
        type: 'string',
        default: 'task/',
        description: 'Prefix for task-related git branches',
      },
      commitPrefix: {
        type: 'string',
        default: 'task:',
        description: 'Prefix for task-related commits',
      },
      autoCommit: {
        type: 'boolean',
        default: false,
        description: 'Automatically commit task changes',
      },
      autoPush: {
        type: 'boolean',
        default: false,
        description: 'Automatically push commits to remote',
      },
    },
    required: [],
  },

  // AI integration settings
  ai: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        default: false,
        description: 'Enable AI integration features',
      },
      provider: {
        type: 'string',
        enum: ['openai', 'claude', 'mistral', 'grok', 'llama', 'lmstudio', 'ollama'],
        default: 'openai',
        description: 'AI provider to use',
      },
      model: {
        type: 'string',
        default: 'gpt-3.5-turbo',
        description: 'AI model to use',
      },
      apiKey: {
        type: 'string',
        default: '',
        description: 'API key for the AI provider',
        sensitive: true,
      },
      baseUrl: {
        type: 'string',
        default: '',
        description: 'Base URL for API calls (for self-hosted models)',
      },
      temperature: {
        type: 'number',
        default: 0.7,
        minimum: 0,
        maximum: 2,
        description: 'Temperature for AI responses',
      },
      maxTokens: {
        type: 'integer',
        default: 2000,
        minimum: 100,
        maximum: 8000,
        description: 'Maximum tokens for AI responses',
      },
    },
    required: [],
  },

  // Output settings
  output: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['text', 'json', 'markdown', 'csv'],
        default: 'text',
        description: 'Default output format',
      },
      color: {
        type: 'boolean',
        default: true,
        description: 'Enable colored output',
      },
      verbose: {
        type: 'boolean',
        default: false,
        description: 'Enable verbose output',
      },
      quiet: {
        type: 'boolean',
        default: false,
        description: 'Suppress non-essential output',
      },
      timestamps: {
        type: 'boolean',
        default: false,
        description: 'Include timestamps in output',
      },
    },
    required: [],
  },

  // Export settings
  export: {
    type: 'object',
    properties: {
      defaultFormat: {
        type: 'string',
        enum: ['json', 'csv', 'markdown', 'html'],
        default: 'json',
        description: 'Default export format',
      },
      includeArchived: {
        type: 'boolean',
        default: false,
        description: 'Include archived tasks in exports',
      },
      includeDeleted: {
        type: 'boolean',
        default: false,
        description: 'Include deleted tasks in exports',
      },
      exportPath: {
        type: 'string',
        default: './exports',
        description: 'Default path for exports',
      },
    },
    required: [],
  },

  // Developer settings
  developer: {
    type: 'object',
    properties: {
      debug: {
        type: 'boolean',
        default: false,
        description: 'Enable debug mode',
      },
      telemetry: {
        type: 'boolean',
        default: false,
        description: 'Enable anonymous usage telemetry',
      },
      experimental: {
        type: 'boolean',
        default: false,
        description: 'Enable experimental features',
      },
      logLevel: {
        type: 'string',
        enum: ['error', 'warn', 'info', 'debug', 'trace'],
        default: 'info',
        description: 'Logging level',
      },
      logConsole: {
        type: 'boolean',
        default: true,
        description: 'Enable console logging',
      },
      logFile: {
        type: 'boolean',
        default: true,
        description: 'Enable file logging',
      },
      logDirectory: {
        type: 'string',
        default: '~/.taskwerk/logs',
        description: 'Directory for log files',
      },
    },
    required: [],
  },
};

/**
 * Get the full schema
 */
export function getConfigSchema() {
  return {
    type: 'object',
    properties: CONFIG_SCHEMA,
    additionalProperties: true, // Allow additional properties for flexibility
    required: [], // No sections are required - they're all optional
  };
}

/**
 * Get default configuration
 */
export function getDefaultConfig() {
  const config = {};
  
  for (const [section, schema] of Object.entries(CONFIG_SCHEMA)) {
    config[section] = {};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if ('default' in propSchema) {
        config[section][key] = propSchema.default;
      }
    }
  }
  
  return config;
}

/**
 * Get sensitive fields that should be masked
 */
export function getSensitiveFields() {
  const sensitive = [];
  
  for (const [section, schema] of Object.entries(CONFIG_SCHEMA)) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.sensitive) {
        sensitive.push(`${section}.${key}`);
      }
    }
  }
  
  return sensitive;
}