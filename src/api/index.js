/**
 * TaskWerk v3 API Layer Entry Point
 *
 * Central API management and method registry for all TaskWerk operations
 */

import { BaseAPI, APIError } from './base-api.js';

/**
 * Main API class that provides access to all TaskWerk functionality
 * Acts as a facade for all sub-APIs and manages the global API state
 */
export class TaskWerkAPI extends BaseAPI {
  constructor(dbPath = null) {
    super(dbPath);
    this.methodRegistry = new Map();
    this.middlewares = [];
    this.apiVersion = '3.0.0';

    // Initialize API method registry
    this.registerCoreMethods();
  }

  /**
   * Register core API methods
   */
  registerCoreMethods() {
    // Health and status methods
    this.register('healthCheck', this.healthCheck.bind(this), {
      description: 'Check API and database health',
      category: 'system',
      type: 'query',
    });

    this.register('getApiInfo', this.getApiInfo.bind(this), {
      description: 'Get API version and capabilities',
      category: 'system',
      type: 'query',
    });

    this.register('getStats', this.getStats.bind(this), {
      description: 'Get database and system statistics',
      category: 'system',
      type: 'query',
    });
  }

  /**
   * Register an API method
   */
  register(name, method, metadata = {}) {
    if (this.methodRegistry.has(name)) {
      throw new APIError(`Method '${name}' is already registered`, 'DUPLICATE_METHOD');
    }

    this.methodRegistry.set(name, {
      method,
      metadata: {
        name,
        description: metadata.description || 'No description provided',
        category: metadata.category || 'uncategorized',
        type: metadata.type || 'action', // 'query', 'action', 'mutation'
        parameters: metadata.parameters || {},
        returns: metadata.returns || 'unknown',
        registeredAt: this.now(),
      },
    });
  }

  /**
   * Unregister an API method
   */
  unregister(name) {
    return this.methodRegistry.delete(name);
  }

  /**
   * Check if method is registered
   */
  hasMethod(name) {
    return this.methodRegistry.has(name);
  }

  /**
   * Get method metadata
   */
  getMethodInfo(name) {
    const entry = this.methodRegistry.get(name);
    return entry ? entry.metadata : null;
  }

  /**
   * List all registered methods
   */
  listMethods(category = null) {
    const methods = Array.from(this.methodRegistry.values()).map(entry => entry.metadata);

    if (category) {
      return methods.filter(method => method.category === category);
    }

    return methods;
  }

  /**
   * Execute an API method with middleware support
   */
  async execute(methodName, params = {}, context = {}) {
    if (!this.hasMethod(methodName)) {
      throw new APIError(`Method '${methodName}' not found`, 'METHOD_NOT_FOUND');
    }

    const methodEntry = this.methodRegistry.get(methodName);
    const startTime = Date.now();

    try {
      // Pre-execution middleware
      for (const middleware of this.middlewares) {
        if (middleware.before) {
          await middleware.before(methodName, params, context);
        }
      }

      // Execute the method
      const result = await methodEntry.method(params, context);

      // Post-execution middleware
      for (const middleware of this.middlewares) {
        if (middleware.after) {
          await middleware.after(methodName, params, result, context);
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        result,
        metadata: {
          method: methodName,
          duration,
          timestamp: this.now(),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Error middleware
      for (const middleware of this.middlewares) {
        if (middleware.error) {
          await middleware.error(methodName, params, error, context);
        }
      }

      return {
        success: false,
        error: {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR',
          details: error.details || {},
        },
        metadata: {
          method: methodName,
          duration,
          timestamp: this.now(),
        },
      };
    }
  }

  /**
   * Add middleware to the API pipeline
   */
  use(middleware) {
    if (typeof middleware !== 'object') {
      throw new APIError('Middleware must be an object', 'INVALID_MIDDLEWARE');
    }

    this.middlewares.push(middleware);
  }

  /**
   * Get API information
   */
  async getApiInfo() {
    return {
      version: this.apiVersion,
      methods: this.methodRegistry.size,
      categories: [...new Set(this.listMethods().map(m => m.category))],
      initialized: this.isInitialized,
      timestamp: this.now(),
    };
  }

  /**
   * Get comprehensive system statistics
   */
  async getStats() {
    // const _db = await this.getDatabase();

    // Get database stats
    const dbStats = this.dbInitializer.getStats();

    // Get API stats
    const methodsByCategory = {};
    for (const method of this.listMethods()) {
      methodsByCategory[method.category] = (methodsByCategory[method.category] || 0) + 1;
    }

    return {
      database: dbStats,
      api: {
        version: this.apiVersion,
        totalMethods: this.methodRegistry.size,
        methodsByCategory,
        middlewares: this.middlewares.length,
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
      timestamp: this.now(),
    };
  }

  /**
   * Batch execute multiple methods
   */
  async batch(operations) {
    if (!Array.isArray(operations)) {
      throw new APIError('Batch operations must be an array', 'INVALID_BATCH');
    }

    const results = [];

    for (const operation of operations) {
      if (!operation.method) {
        results.push({
          success: false,
          error: {
            message: 'Missing method name',
            code: 'MISSING_METHOD',
          },
        });
        continue;
      }

      try {
        const result = await this.execute(
          operation.method,
          operation.params || {},
          operation.context || {}
        );
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: {
            message: error.message,
            code: error.code || 'BATCH_ERROR',
          },
        });
      }
    }

    return {
      success: true,
      results,
      metadata: {
        batchSize: operations.length,
        timestamp: this.now(),
      },
    };
  }
}

/**
 * Create a default API instance
 */
export function createAPI(dbPath = null) {
  return new TaskWerkAPI(dbPath);
}

/**
 * Export error classes for use by API consumers
 */
export { APIError, ValidationError } from './base-api.js';

export default TaskWerkAPI;
