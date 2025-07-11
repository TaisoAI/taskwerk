import { describe, it, expect } from 'vitest';
import {
  TaskwerkError,
  ValidationError,
  DatabaseError,
  FileSystemError,
  ConfigurationError,
  CLIError,
} from '../../src/errors/base-error.js';

describe('Base Error Classes', () => {
  describe('TaskwerkError', () => {
    it('should create error with all properties', () => {
      const error = new TaskwerkError('Test error', 'TEST_ERROR', 500, { extra: 'data' });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ extra: 'data' });
      expect(error.timestamp).toBeTruthy();
      expect(error.name).toBe('TaskwerkError');
    });

    it('should serialize to JSON correctly', () => {
      const error = new TaskwerkError('Test error', 'TEST_ERROR');
      const json = error.toJSON();

      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('statusCode');
      expect(json).toHaveProperty('details');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('stack');
    });

    it('should have correct string representation', () => {
      const error = new TaskwerkError('Test error', 'TEST_ERROR');
      expect(error.toString()).toBe('TaskwerkError [TEST_ERROR]: Test error');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field and value', () => {
      const error = new ValidationError('Invalid email', 'email', 'not-an-email');

      expect(error.message).toBe('Invalid email');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'email', value: 'not-an-email' });
    });

    it('should handle null field and value', () => {
      const error = new ValidationError('General validation error');

      expect(error.details).toEqual({});
    });
  });

  describe('DatabaseError', () => {
    it('should create database error with operation and query', () => {
      const error = new DatabaseError('Connection failed', 'CONNECT', 'SELECT * FROM tasks');

      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({
        operation: 'CONNECT',
        query: 'SELECT * FROM tasks',
      });
    });
  });

  describe('FileSystemError', () => {
    it('should create filesystem error with path and operation', () => {
      const error = new FileSystemError('File not found', '/tmp/test.txt', 'READ');

      expect(error.message).toBe('File not found');
      expect(error.code).toBe('FILESYSTEM_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({
        path: '/tmp/test.txt',
        operation: 'READ',
      });
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error with key and value', () => {
      const error = new ConfigurationError('Invalid config', 'database.host', 'invalid-host');

      expect(error.message).toBe('Invalid config');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({
        configKey: 'database.host',
        configValue: 'invalid-host',
      });
    });

    it('should handle undefined config value', () => {
      const error = new ConfigurationError('Missing config', 'api.key', undefined);

      expect(error.details).toEqual({
        configKey: 'api.key',
        configValue: null,
      });
    });
  });

  describe('CLIError', () => {
    it('should create CLI error with command and args', () => {
      const error = new CLIError('Invalid command', 'task add', ['--invalid-flag']);

      expect(error.message).toBe('Invalid command');
      expect(error.code).toBe('CLI_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({
        command: 'task add',
        args: ['--invalid-flag'],
      });
    });
  });
});
