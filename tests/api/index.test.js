/**
 * Tests for TaskWerk v3 Main API Layer
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { TaskWerkAPI, createAPI, APIError } from '../../src/api/index.js';

describe('TaskWerk API Layer', () => {
  let api;
  let dbPath;

  beforeEach(async () => {
    // Use temporary database for each test
    dbPath = join('/tmp', `taskwerk-main-api-test-${Date.now()}.db`);
    api = new TaskWerkAPI(dbPath);
    // Initialize the database
    await api.initialize();
  });

  afterEach(() => {
    // Clean up test database
    if (api) {
      api.close();
    }
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  describe('Constructor and Setup', () => {
    test('should create API instance', () => {
      assert.ok(api instanceof TaskWerkAPI);
      assert.strictEqual(api.apiVersion, '3.0.0');
      assert.ok(api.methodRegistry instanceof Map);
      assert.ok(Array.isArray(api.middlewares));
    });

    test('should register core methods automatically', () => {
      assert.ok(api.hasMethod('healthCheck'));
      assert.ok(api.hasMethod('getApiInfo'));
      assert.ok(api.hasMethod('getStats'));
    });

    test('should create API with factory function', () => {
      const factoryApi = createAPI(dbPath);
      assert.ok(factoryApi instanceof TaskWerkAPI);
    });
  });

  describe('Method Registry', () => {
    test('should register new method', () => {
      const testMethod = () => 'test result';

      api.register('testMethod', testMethod, {
        description: 'A test method',
        category: 'test',
      });

      assert.ok(api.hasMethod('testMethod'));

      const info = api.getMethodInfo('testMethod');
      assert.strictEqual(info.name, 'testMethod');
      assert.strictEqual(info.description, 'A test method');
      assert.strictEqual(info.category, 'test');
    });

    test('should prevent duplicate method registration', () => {
      const testMethod = () => 'test';

      api.register('testMethod', testMethod);

      assert.throws(() => {
        api.register('testMethod', testMethod);
      }, APIError);
    });

    test('should unregister method', () => {
      const testMethod = () => 'test';
      api.register('testMethod', testMethod);

      assert.ok(api.hasMethod('testMethod'));

      const removed = api.unregister('testMethod');
      assert.strictEqual(removed, true);
      assert.strictEqual(api.hasMethod('testMethod'), false);
    });

    test('should list all methods', () => {
      const methods = api.listMethods();
      assert.ok(Array.isArray(methods));
      assert.ok(methods.length >= 3); // At least the core methods

      const methodNames = methods.map(m => m.name);
      assert.ok(methodNames.includes('healthCheck'));
      assert.ok(methodNames.includes('getApiInfo'));
      assert.ok(methodNames.includes('getStats'));
    });

    test('should list methods by category', () => {
      const testMethod = () => 'test';
      api.register('testMethod', testMethod, { category: 'test' });

      const systemMethods = api.listMethods('system');
      const testMethods = api.listMethods('test');

      assert.ok(systemMethods.length >= 3);
      assert.strictEqual(testMethods.length, 1);
      assert.strictEqual(testMethods[0].name, 'testMethod');
    });

    test('should get method info', () => {
      const info = api.getMethodInfo('healthCheck');

      assert.ok(info);
      assert.strictEqual(info.name, 'healthCheck');
      assert.strictEqual(info.category, 'system');
      assert.ok(info.registeredAt);
    });

    test('should return null for non-existent method info', () => {
      const info = api.getMethodInfo('nonExistentMethod');
      assert.strictEqual(info, null);
    });
  });

  describe('Method Execution', () => {
    test('should execute registered method', async () => {
      const testMethod = params => `Hello ${params.name}`;
      api.register('greet', testMethod);

      const result = await api.execute('greet', { name: 'World' });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'Hello World');
      assert.ok(result.metadata);
      assert.strictEqual(result.metadata.method, 'greet');
      assert.ok(typeof result.metadata.duration === 'number');
    });

    test('should handle method execution errors', async () => {
      const failingMethod = () => {
        throw new Error('Method failed');
      };
      api.register('failingMethod', failingMethod);

      const result = await api.execute('failingMethod');

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.strictEqual(result.error.message, 'Method failed');
      assert.ok(result.metadata);
    });

    test('should throw error for non-existent method', async () => {
      try {
        await api.execute('nonExistentMethod');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof APIError);
        assert.strictEqual(error.code, 'METHOD_NOT_FOUND');
      }
    });

    test('should execute async method', async () => {
      const asyncMethod = async params => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return `Async result: ${params.value}`;
      };
      api.register('asyncMethod', asyncMethod);

      const result = await api.execute('asyncMethod', { value: 'test' });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, 'Async result: test');
    });
  });

  describe('Middleware System', () => {
    test('should execute before middleware', async () => {
      let beforeCalled = false;

      const middleware = {
        before: async (methodName, _params) => {
          beforeCalled = true;
          assert.strictEqual(methodName, 'testMethod');
        },
      };

      api.use(middleware);
      api.register('testMethod', () => 'result');

      await api.execute('testMethod');
      assert.strictEqual(beforeCalled, true);
    });

    test('should execute after middleware', async () => {
      let afterCalled = false;

      const middleware = {
        after: async (methodName, params, result) => {
          afterCalled = true;
          assert.strictEqual(result, 'result');
        },
      };

      api.use(middleware);
      api.register('testMethod', () => 'result');

      await api.execute('testMethod');
      assert.strictEqual(afterCalled, true);
    });

    test('should execute error middleware', async () => {
      let errorCalled = false;

      const middleware = {
        error: async (methodName, params, error) => {
          errorCalled = true;
          assert.strictEqual(error.message, 'Test error');
        },
      };

      api.use(middleware);
      api.register('failingMethod', () => {
        throw new Error('Test error');
      });

      await api.execute('failingMethod');
      assert.strictEqual(errorCalled, true);
    });

    test('should reject invalid middleware', () => {
      assert.throws(() => {
        api.use('invalid middleware');
      }, APIError);
    });
  });

  describe('Core API Methods', () => {
    test('should get API info', async () => {
      const info = await api.getApiInfo();

      assert.strictEqual(info.version, '3.0.0');
      assert.ok(typeof info.methods === 'number');
      assert.ok(Array.isArray(info.categories));
      assert.ok(info.categories.includes('system'));
      assert.ok(info.timestamp);
    });

    test('should get comprehensive stats', async () => {
      const stats = await api.getStats();

      assert.ok(stats.database);
      assert.ok(stats.api);
      assert.ok(stats.system);

      assert.strictEqual(stats.api.version, '3.0.0');
      assert.ok(typeof stats.api.totalMethods === 'number');
      assert.ok(stats.api.methodsByCategory);

      assert.ok(stats.system.nodeVersion);
      assert.ok(stats.system.platform);
      assert.ok(typeof stats.system.uptime === 'number');
    });

    test('should perform health check', async () => {
      const result = await api.execute('healthCheck');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result.status, 'healthy');
      assert.strictEqual(result.result.database, 'connected');
    });
  });

  describe('Batch Operations', () => {
    test('should execute batch operations', async () => {
      api.register('add', params => params.a + params.b);
      api.register('multiply', params => params.a * params.b);

      const operations = [
        { method: 'add', params: { a: 1, b: 2 } },
        { method: 'multiply', params: { a: 3, b: 4 } },
        { method: 'getApiInfo' },
      ];

      const result = await api.batch(operations);

      assert.strictEqual(result.success, true);
      assert.ok(Array.isArray(result.results));
      assert.strictEqual(result.results.length, 3);

      assert.strictEqual(result.results[0].success, true);
      assert.strictEqual(result.results[0].result, 3);

      assert.strictEqual(result.results[1].success, true);
      assert.strictEqual(result.results[1].result, 12);

      assert.strictEqual(result.results[2].success, true);
      assert.ok(result.results[2].result.version);
    });

    test('should handle batch operation errors', async () => {
      api.register('failingMethod', () => {
        throw new Error('Method failed');
      });

      const operations = [
        { method: 'nonExistentMethod' },
        { method: 'failingMethod' },
        { method: 'getApiInfo' },
      ];

      const result = await api.batch(operations);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.results.length, 3);

      assert.strictEqual(result.results[0].success, false);
      assert.strictEqual(result.results[1].success, false);
      assert.strictEqual(result.results[2].success, true);
    });

    test('should reject invalid batch input', async () => {
      try {
        await api.batch('not an array');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof APIError);
        assert.strictEqual(error.code, 'INVALID_BATCH');
      }
    });

    test('should handle missing method in batch', async () => {
      const operations = [
        { params: { a: 1 } }, // Missing method
      ];

      const result = await api.batch(operations);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.results[0].success, false);
      assert.strictEqual(result.results[0].error.code, 'MISSING_METHOD');
    });
  });

  describe('Integration', () => {
    test('should initialize and work end-to-end', async () => {
      // Initialize API
      await api.initialize();

      // Register a custom method
      api.register('createTask', params => {
        return { id: 1, name: params.name, status: 'todo' };
      });

      // Execute method
      const result = await api.execute('createTask', { name: 'Test Task' });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result.name, 'Test Task');

      // Check health
      const health = await api.execute('healthCheck');
      assert.strictEqual(health.success, true);
      assert.strictEqual(health.result.status, 'healthy');
    });
  });
});
