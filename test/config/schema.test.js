import { describe, it, expect } from 'vitest';
import {
  CONFIG_SCHEMA,
  getConfigSchema,
  getDefaultConfig,
  getSensitiveFields,
} from '../../src/config/schema.js';

describe('Configuration Schema', () => {
  describe('CONFIG_SCHEMA', () => {
    it('should define all configuration sections', () => {
      expect(CONFIG_SCHEMA).toHaveProperty('general');
      expect(CONFIG_SCHEMA).toHaveProperty('database');
      expect(CONFIG_SCHEMA).toHaveProperty('git');
      expect(CONFIG_SCHEMA).toHaveProperty('ai');
      expect(CONFIG_SCHEMA).toHaveProperty('output');
      expect(CONFIG_SCHEMA).toHaveProperty('export');
      expect(CONFIG_SCHEMA).toHaveProperty('developer');
    });

    it('should have valid schema structure for each section', () => {
      for (const schema of Object.values(CONFIG_SCHEMA)) {
        expect(schema).toHaveProperty('type', 'object');
        expect(schema).toHaveProperty('properties');
        expect(schema).toHaveProperty('required');
        expect(Array.isArray(schema.required)).toBe(true);
      }
    });

    it('should define enum values for constrained fields', () => {
      expect(CONFIG_SCHEMA.general.properties.defaultPriority.enum).toEqual([
        'low',
        'medium',
        'high',
        'critical',
      ]);
      expect(CONFIG_SCHEMA.general.properties.defaultStatus.enum).toEqual([
        'todo',
        'in-progress',
        'blocked',
        'done',
      ]);
      expect(CONFIG_SCHEMA.ai.properties.provider.enum).toContain('openai');
      expect(CONFIG_SCHEMA.ai.properties.provider.enum).toContain('claude');
    });

    it('should define numeric constraints', () => {
      const tempSchema = CONFIG_SCHEMA.ai.properties.temperature;
      expect(tempSchema.minimum).toBe(0);
      expect(tempSchema.maximum).toBe(2);

      const backupCountSchema = CONFIG_SCHEMA.database.properties.backupCount;
      expect(backupCountSchema.minimum).toBe(1);
      expect(backupCountSchema.maximum).toBe(365);
    });

    it('should mark sensitive fields', () => {
      expect(CONFIG_SCHEMA.ai.properties.apiKey.sensitive).toBe(true);
    });
  });

  describe('getConfigSchema', () => {
    it('should return complete schema with root object type', () => {
      const schema = getConfigSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBe(CONFIG_SCHEMA);
      expect(schema.additionalProperties).toBe(true);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return configuration with all default values', () => {
      const config = getDefaultConfig();

      expect(config.general.defaultPriority).toBe('medium');
      expect(config.general.defaultStatus).toBe('todo');
      expect(config.general.taskIdPrefix).toBe('TASK');
      expect(config.general.dateFormat).toBe('YYYY-MM-DD');

      expect(config.database.path).toBe('~/.taskwerk/taskwerk.db');
      expect(config.database.backupEnabled).toBe(true);
      expect(config.database.backupInterval).toBe('daily');
      expect(config.database.backupCount).toBe(7);

      expect(config.git.enabled).toBe(true);
      expect(config.git.branchPrefix).toBe('task/');
      expect(config.git.autoCommit).toBe(false);

      expect(config.ai.enabled).toBe(false);
      expect(config.ai.provider).toBe('openai');
      expect(config.ai.temperature).toBe(0.7);

      expect(config.output.format).toBe('text');
      expect(config.output.color).toBe(true);
      expect(config.output.verbose).toBe(false);

      expect(config.developer.debug).toBe(false);
      expect(config.developer.telemetry).toBe(false);
    });

    it('should not include properties without defaults', () => {
      const config = getDefaultConfig();
      
      // These don't have defaults in the schema
      expect(config.ai.apiKey).toBe('');
      expect(config.ai.baseUrl).toBe('');
    });
  });

  describe('getSensitiveFields', () => {
    it('should return array of sensitive field paths', () => {
      const sensitive = getSensitiveFields();
      
      expect(Array.isArray(sensitive)).toBe(true);
      expect(sensitive).toContain('ai.apiKey');
    });

    it('should only include fields marked as sensitive', () => {
      const sensitive = getSensitiveFields();
      
      // These should not be sensitive
      expect(sensitive).not.toContain('general.defaultPriority');
      expect(sensitive).not.toContain('database.path');
      expect(sensitive).not.toContain('ai.provider');
    });
  });
});