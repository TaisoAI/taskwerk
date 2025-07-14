import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadFromEnv,
  getEnvName,
  exportToEnv,
  mergeEnvConfig,
} from '../../src/config/env-loader.js';

describe('Environment Variable Loader', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadFromEnv', () => {
    it('should load simple values from environment', () => {
      process.env.TASKWERK_GENERAL_DEFAULT_PRIORITY = 'high';
      process.env.TASKWERK_OUTPUT_COLOR = 'false';

      const config = loadFromEnv();

      expect(config.general.defaultPriority).toBe('high');
      expect(config.output.color).toBe(false);
    });

    it('should parse JSON values', () => {
      process.env.TASKWERK_AI_TEMPERATURE = '0.9';
      process.env.TASKWERK_DATABASE_BACKUP_COUNT = '14';
      process.env.TASKWERK_OUTPUT_VERBOSE = 'true';

      const config = loadFromEnv();

      expect(config.ai.temperature).toBe(0.9);
      expect(config.database.backupCount).toBe(14);
      expect(config.output.verbose).toBe(true);
    });

    it('should handle camelCase conversion', () => {
      process.env.TASKWERK_DATABASE_BACKUP_ENABLED = 'false';
      process.env.TASKWERK_GIT_AUTO_COMMIT = 'true';

      const config = loadFromEnv();

      expect(config.database.backupEnabled).toBe(false);
      expect(config.git.autoCommit).toBe(true);
    });

    it('should ignore non-TASKWERK variables', () => {
      process.env.OTHER_VAR = 'value';
      process.env.TASKWERK_VALID = 'test';

      const config = loadFromEnv();

      expect(config.valid).toBe('test');
      expect(config.OTHER_VAR).toBeUndefined();
    });

    it('should handle nested paths', () => {
      process.env.TASKWERK_AI_PROVIDER = 'claude';
      process.env.TASKWERK_EXPORT_DEFAULT_FORMAT = 'csv';

      const config = loadFromEnv();

      expect(config.ai.provider).toBe('claude');
      expect(config.export.defaultFormat).toBe('csv');
    });
  });

  describe('getEnvName', () => {
    it('should convert config path to env variable name', () => {
      expect(getEnvName('general.defaultPriority')).toBe('TASKWERK_GENERAL_DEFAULT_PRIORITY');
      expect(getEnvName('database.backupEnabled')).toBe('TASKWERK_DATABASE_BACKUP_ENABLED');
      expect(getEnvName('ai.apiKey')).toBe('TASKWERK_AI_API_KEY');
    });

    it('should handle single-level paths', () => {
      expect(getEnvName('debug')).toBe('TASKWERK_DEBUG');
    });

    it('should handle multi-word camelCase', () => {
      expect(getEnvName('export.includeArchived')).toBe('TASKWERK_EXPORT_INCLUDE_ARCHIVED');
      expect(getEnvName('git.autoCommit')).toBe('TASKWERK_GIT_AUTO_COMMIT');
    });
  });

  describe('exportToEnv', () => {
    const testConfig = {
      general: {
        defaultPriority: 'high',
        defaultStatus: 'in-progress',
      },
      database: {
        backupEnabled: false,
        backupCount: 14,
      },
      ai: {
        provider: 'claude',
        temperature: 0.8,
      },
    };

    it('should export config as environment variables', () => {
      const result = exportToEnv(testConfig, false);

      expect(result).toContain('export TASKWERK_GENERAL_DEFAULT_PRIORITY="high"');
      expect(result).toContain('export TASKWERK_GENERAL_DEFAULT_STATUS="in-progress"');
      expect(result).toContain('export TASKWERK_DATABASE_BACKUP_ENABLED="false"');
      expect(result).toContain('export TASKWERK_DATABASE_BACKUP_COUNT="14"');
      expect(result).toContain('export TASKWERK_AI_PROVIDER="claude"');
      expect(result).toContain('export TASKWERK_AI_TEMPERATURE="0.8"');
    });

    it('should include comments when requested', () => {
      const result = exportToEnv(testConfig, true);

      expect(result).toContain('# Taskwerk Configuration Environment Variables');
      expect(result).toContain('# Generated on');
    });

    it('should handle nested objects', () => {
      const nestedConfig = {
        deeply: {
          nested: {
            value: 'test',
          },
        },
      };

      const result = exportToEnv(nestedConfig, false);
      // Should flatten section.property but keep deeper nesting as JSON
      expect(result).toContain('export TASKWERK_DEEPLY_NESTED="{\\"value\\":\\"test\\"}"');
    });

    it('should JSON stringify non-string values', () => {
      const config = {
        test: {
          array: [1, 2, 3],
          object: { key: 'value' },
        },
      };

      const result = exportToEnv(config, false);
      expect(result).toContain('export TASKWERK_TEST_ARRAY="[1,2,3]"');
      expect(result).toContain('export TASKWERK_TEST_OBJECT="{\\"key\\":\\"value\\"}"');
    });
  });

  describe('mergeEnvConfig', () => {
    it('should merge env config with priority', () => {
      process.env.TASKWERK_GENERAL_DEFAULT_PRIORITY = 'critical';
      process.env.TASKWERK_OUTPUT_FORMAT = 'json';

      const baseConfig = {
        general: {
          defaultPriority: 'low',
          defaultStatus: 'todo',
        },
        output: {
          format: 'text',
          color: true,
        },
      };

      const merged = mergeEnvConfig(baseConfig);

      // Env vars should override
      expect(merged.general.defaultPriority).toBe('critical');
      expect(merged.output.format).toBe('json');

      // Other values should remain
      expect(merged.general.defaultStatus).toBe('todo');
      expect(merged.output.color).toBe(true);
    });

    it('should add new properties from env', () => {
      process.env.TASKWERK_NEWSECTION_VALUE = 'test';

      const baseConfig = {
        existing: {
          value: 'original',
        },
      };

      const merged = mergeEnvConfig(baseConfig);

      expect(merged.existing.value).toBe('original');
      expect(merged.newsection.value).toBe('test');
    });

    it('should handle deep merging', () => {
      process.env.TASKWERK_DATABASE_BACKUP_COUNT = '30';

      const baseConfig = {
        database: {
          path: '/tmp/test.db',
          backupEnabled: true,
          backupCount: 7,
        },
      };

      const merged = mergeEnvConfig(baseConfig);

      expect(merged.database.path).toBe('/tmp/test.db');
      expect(merged.database.backupEnabled).toBe(true);
      expect(merged.database.backupCount).toBe(30);
    });
  });
});
