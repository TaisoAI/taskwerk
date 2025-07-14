import { describe, it, expect, beforeEach } from 'vitest';
import { Validator, ValidationRules, TaskValidator } from '../../src/api/validation.js';

describe('Validation', () => {
  describe('ValidationRules', () => {
    it('should define task status values', () => {
      expect(ValidationRules.TASK_STATUS).toContain('todo');
      expect(ValidationRules.TASK_STATUS).toContain('in-progress');
      expect(ValidationRules.TASK_STATUS).toContain('in_progress');
      expect(ValidationRules.TASK_STATUS).toContain('blocked');
      expect(ValidationRules.TASK_STATUS).toContain('done');
      expect(ValidationRules.TASK_STATUS).toContain('completed');
      expect(ValidationRules.TASK_STATUS).toContain('cancelled');
    });

    it('should define task priority values', () => {
      expect(ValidationRules.TASK_PRIORITY).toContain('low');
      expect(ValidationRules.TASK_PRIORITY).toContain('medium');
      expect(ValidationRules.TASK_PRIORITY).toContain('high');
      expect(ValidationRules.TASK_PRIORITY).toContain('critical');
    });

    it('should define task ID pattern', () => {
      expect(ValidationRules.TASK_ID_PATTERN.test('TASK-123')).toBe(true);
      expect(ValidationRules.TASK_ID_PATTERN.test('BUG-456')).toBe(true);
      expect(ValidationRules.TASK_ID_PATTERN.test('TASK-123.1')).toBe(true);
      expect(ValidationRules.TASK_ID_PATTERN.test('task-123')).toBe(false);
      expect(ValidationRules.TASK_ID_PATTERN.test('TASK123')).toBe(false);
    });

    it('should define email pattern', () => {
      expect(ValidationRules.EMAIL_PATTERN.test('user@example.com')).toBe(true);
      expect(ValidationRules.EMAIL_PATTERN.test('test.email+tag@domain.co.uk')).toBe(true);
      expect(ValidationRules.EMAIL_PATTERN.test('invalid.email')).toBe(false);
      expect(ValidationRules.EMAIL_PATTERN.test('@domain.com')).toBe(false);
    });

    it('should define URL pattern', () => {
      expect(ValidationRules.URL_PATTERN.test('https://example.com')).toBe(true);
      expect(ValidationRules.URL_PATTERN.test('http://localhost:3000')).toBe(true);
      expect(ValidationRules.URL_PATTERN.test('ftp://example.com')).toBe(false);
      expect(ValidationRules.URL_PATTERN.test('example.com')).toBe(false);
    });
  });

  describe('Validator', () => {
    let validator;

    beforeEach(() => {
      validator = new Validator();
    });

    describe('Basic Validation', () => {
      it('should validate required fields', () => {
        validator.required('name', '');
        validator.required('name', null);
        validator.required('name', undefined);
        validator.required('valid', 'value');

        expect(validator.hasErrors()).toBe(true);
        expect(validator.getErrors()).toHaveLength(3);
        expect(validator.getErrors()[0].field).toBe('name');
        expect(validator.getErrors()[0].message).toBe('is required');
      });

      it('should validate string length', () => {
        validator.length('short', 'ab', 3, 10);
        validator.length('long', 'abcdefghijk', 3, 10);
        validator.length('valid', 'abcde', 3, 10);

        expect(validator.hasErrors()).toBe(true);
        expect(validator.getErrors()).toHaveLength(2);
      });

      it('should validate number range', () => {
        validator.range('low', 5, 10, 20);
        validator.range('high', 25, 10, 20);
        validator.range('valid', 15, 10, 20);
        validator.range('invalid', 'not-a-number', 10, 20);

        expect(validator.hasErrors()).toBe(true);
        expect(validator.getErrors()).toHaveLength(3);
      });

      it('should validate oneOf constraint', () => {
        validator.oneOf('status', 'invalid', ['todo', 'done']);
        validator.oneOf('priority', 'high', ['low', 'medium', 'high']);

        expect(validator.hasErrors()).toBe(true);
        expect(validator.getErrors()).toHaveLength(1);
        expect(validator.getErrors()[0].field).toBe('status');
      });

      it('should validate patterns', () => {
        validator.pattern('code', 'ABC123', /^[A-Z]{3}\d{3}$/, 'must be 3 letters and 3 digits');
        validator.pattern('invalid', 'abc123', /^[A-Z]{3}\d{3}$/, 'must be 3 letters and 3 digits');

        expect(validator.hasErrors()).toBe(true);
        expect(validator.getErrors()).toHaveLength(1);
        expect(validator.getErrors()[0].message).toBe('must be 3 letters and 3 digits');
      });
    });

    describe('Specialized Validation', () => {
      it('should validate task IDs', () => {
        validator.taskId('valid_id', 'TASK-123');
        validator.taskId('invalid_id', 'task-123');

        expect(validator.hasErrors()).toBe(true);
        expect(validator.getErrors()).toHaveLength(1);
        expect(validator.getErrors()[0].field).toBe('invalid_id');
      });

      it('should validate email addresses', () => {
        validator.email('valid_email', 'user@example.com');
        validator.email('invalid_email', 'not-an-email');

        expect(validator.hasErrors()).toBe(true);
        expect(validator.getErrors()).toHaveLength(1);
        expect(validator.getErrors()[0].field).toBe('invalid_email');
      });

      it('should validate URLs', () => {
        validator.url('valid_url', 'https://example.com');
        validator.url('invalid_url', 'not-a-url');

        expect(validator.hasErrors()).toBe(true);
        expect(validator.getErrors()).toHaveLength(1);
        expect(validator.getErrors()[0].field).toBe('invalid_url');
      });

      it('should validate dates', () => {
        validator.date('valid_date', '2024-01-01T00:00:00.000Z');
        validator.date('invalid_date', 'not-a-date');

        expect(validator.hasErrors()).toBe(true);
        expect(validator.getErrors()).toHaveLength(1);
        expect(validator.getErrors()[0].field).toBe('invalid_date');
      });

      it('should validate JSON strings', () => {
        validator.json('valid_json', '{"key": "value"}');
        validator.json('invalid_json', '{invalid json}');
        validator.json('not_string', 123);

        expect(validator.hasErrors()).toBe(true);
        expect(validator.getErrors()).toHaveLength(2);
      });
    });

    describe('Error Handling', () => {
      it('should reset errors', () => {
        validator.required('field', '');
        expect(validator.hasErrors()).toBe(true);

        validator.reset();
        expect(validator.hasErrors()).toBe(false);
        expect(validator.getErrors()).toHaveLength(0);
      });

      it('should throw validation errors', () => {
        validator.required('field1', '');
        validator.required('field2', null);

        expect(() => validator.throwIfErrors()).toThrow(
          /Validation failed.*field1.*is required.*field2.*is required/
        );
      });

      it('should not throw when no errors', () => {
        validator.required('field', 'value');
        expect(() => validator.throwIfErrors()).not.toThrow();
      });
    });
  });

  describe('TaskValidator', () => {
    describe('Create Validation', () => {
      it('should validate valid task creation data', () => {
        const taskData = {
          name: 'Valid task',
          description: 'Valid description',
          status: 'todo',
          priority: 'medium',
          assignee: 'user1',
          estimate: 120,
          progress: 0,
          due_date: '2024-12-31T23:59:59.999Z',
          content: 'Some content',
          category: 'feature',
          metadata: { custom: 'field' },
          context: { branch: 'main' },
        };

        const result = TaskValidator.validateCreate(taskData);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should require task name', () => {
        const taskData = {};

        const result = TaskValidator.validateCreate(taskData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('name');
        expect(result.errors[0].message).toBe('is required');
      });

      it('should validate task ID format', () => {
        const taskData = {
          id: 'invalid-id',
          name: 'Test task',
        };

        const result = TaskValidator.validateCreate(taskData);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'id')).toBe(true);
      });

      it('should validate status values', () => {
        const taskData = {
          name: 'Test task',
          status: 'invalid-status',
        };

        const result = TaskValidator.validateCreate(taskData);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'status')).toBe(true);
      });

      it('should validate priority values', () => {
        const taskData = {
          name: 'Test task',
          priority: 'invalid-priority',
        };

        const result = TaskValidator.validateCreate(taskData);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'priority')).toBe(true);
      });

      it('should validate progress range', () => {
        const taskData = {
          name: 'Test task',
          progress: 150,
        };

        const result = TaskValidator.validateCreate(taskData);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'progress')).toBe(true);
      });

      it('should validate string lengths', () => {
        const taskData = {
          name: 'x'.repeat(300), // Too long
          description: 'x'.repeat(1100), // Too long
          assignee: '', // Too short
          category: 'x'.repeat(60), // Too long
        };

        const result = TaskValidator.validateCreate(taskData);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should validate JSON metadata', () => {
        const taskData = {
          name: 'Test task',
          metadata: '{invalid json}',
        };

        const result = TaskValidator.validateCreate(taskData);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'metadata')).toBe(true);
      });

      it('should accept object metadata', () => {
        const taskData = {
          name: 'Test task',
          metadata: { valid: 'object' },
        };

        const result = TaskValidator.validateCreate(taskData);

        expect(result.isValid).toBe(true);
      });
    });

    describe('Update Validation', () => {
      it('should validate valid update data', () => {
        const updateData = {
          name: 'Updated task',
          status: 'in-progress',
          priority: 'high',
          progress: 50,
        };

        const result = TaskValidator.validateUpdate(updateData);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should prevent updating task ID', () => {
        const updateData = {
          id: 'NEW-ID',
          name: 'Updated task',
        };

        const result = TaskValidator.validateUpdate(updateData);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'id')).toBe(true);
        expect(result.errors.find(e => e.field === 'id').message).toBe('cannot be updated');
      });

      it('should validate name when provided', () => {
        const updateData = {
          name: '', // Empty name not allowed
        };

        const result = TaskValidator.validateUpdate(updateData);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'name')).toBe(true);
      });

      it('should allow null values for optional fields', () => {
        const updateData = {
          description: null,
          assignee: null,
          estimate: null,
          due_date: null,
          content: null,
          category: null,
        };

        const result = TaskValidator.validateUpdate(updateData);

        expect(result.isValid).toBe(true);
      });

      it('should validate when fields are provided', () => {
        const updateData = {
          status: 'invalid-status',
          priority: 'invalid-priority',
          progress: 150,
        };

        const result = TaskValidator.validateUpdate(updateData);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBe(3);
      });
    });
  });
});
