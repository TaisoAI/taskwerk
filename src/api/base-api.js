/**
 * TaskWerk v3 Base API Layer
 * 
 * Provides the foundation for all API operations with database connection 
 * management, transaction handling, and validation framework.
 */

import { DatabaseInitializer } from '../core/database/init.js';

/**
 * Base API class that all other API classes extend
 * Provides common functionality for database operations, transactions, and validation
 */
export class BaseAPI {
    constructor(dbPath = null) {
        this.dbInitializer = new DatabaseInitializer(dbPath);
        this.db = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the API and database connection
     */
    async initialize(force = false) {
        if (this.isInitialized && !force) {
            return { success: true, created: false };
        }

        try {
            const result = await this.dbInitializer.initialize(force);
            this.db = this.dbInitializer.getConnection();
            this.isInitialized = true;
            return result;
        } catch (error) {
            throw new APIError('Failed to initialize API', 'INIT_ERROR', { cause: error });
        }
    }

    /**
     * Get database connection, initializing if necessary
     */
    async getDatabase() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.db;
    }

    /**
     * Execute operation within a database transaction
     * Automatically rolls back on error, commits on success
     */
    async transaction(operation) {
        const db = await this.getDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(() => {
                try {
                    const result = operation(db);
                    return result;
                } catch (error) {
                    throw error;
                }
            });

            try {
                const result = transaction();
                resolve(result);
            } catch (error) {
                reject(new APIError('Transaction failed', 'TRANSACTION_ERROR', { cause: error }));
            }
        });
    }

    /**
     * Validate input against schema rules
     */
    validate(data, schema) {
        const errors = [];
        
        // Check required fields
        if (schema.required) {
            for (const field of schema.required) {
                if (data[field] === undefined || data[field] === null) {
                    errors.push(`Required field '${field}' is missing`);
                }
            }
        }

        // Check field types and constraints
        if (schema.properties) {
            for (const [field, rules] of Object.entries(schema.properties)) {
                const value = data[field];
                
                if (value !== undefined && value !== null) {
                    // Type validation
                    if (rules.type && typeof value !== rules.type) {
                        errors.push(`Field '${field}' must be of type ${rules.type}`);
                    }

                    // Enum validation
                    if (rules.enum && !rules.enum.includes(value)) {
                        errors.push(`Field '${field}' must be one of: ${rules.enum.join(', ')}`);
                    }

                    // String length validation
                    if (rules.type === 'string') {
                        if (rules.minLength && value.length < rules.minLength) {
                            errors.push(`Field '${field}' must be at least ${rules.minLength} characters`);
                        }
                        if (rules.maxLength && value.length > rules.maxLength) {
                            errors.push(`Field '${field}' must be no more than ${rules.maxLength} characters`);
                        }
                    }

                    // Number validation
                    if (rules.type === 'number') {
                        if (rules.min !== undefined && value < rules.min) {
                            errors.push(`Field '${field}' must be at least ${rules.min}`);
                        }
                        if (rules.max !== undefined && value > rules.max) {
                            errors.push(`Field '${field}' must be no more than ${rules.max}`);
                        }
                    }

                    // Custom validation function
                    if (rules.validate && typeof rules.validate === 'function') {
                        const customError = rules.validate(value);
                        if (customError) {
                            errors.push(customError);
                        }
                    }
                }
            }
        }

        if (errors.length > 0) {
            throw new ValidationError('Validation failed', errors);
        }

        return true;
    }

    /**
     * Sanitize input data by removing undefined fields and trimming strings
     */
    sanitize(data) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                if (typeof value === 'string') {
                    sanitized[key] = value.trim();
                } else {
                    sanitized[key] = value;
                }
            }
        }
        
        return sanitized;
    }

    /**
     * Generate timestamp in ISO format
     */
    now() {
        return new Date().toISOString();
    }

    /**
     * Close database connection
     */
    close() {
        if (this.dbInitializer) {
            this.dbInitializer.close();
        }
        this.db = null;
        this.isInitialized = false;
    }

    /**
     * Health check - verify API and database are working
     */
    async healthCheck() {
        try {
            const db = await this.getDatabase();
            
            // Test basic database operation
            const result = db.prepare("SELECT COUNT(*) as count FROM tasks").get();
            
            return {
                status: 'healthy',
                database: 'connected',
                taskCount: result.count,
                timestamp: this.now()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                database: 'error',
                error: error.message,
                timestamp: this.now()
            };
        }
    }
}

/**
 * Custom API Error class
 */
export class APIError extends Error {
    constructor(message, code = 'API_ERROR', details = {}) {
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Validation Error class
 */
export class ValidationError extends Error {
    constructor(message, errors = []) {
        super(message);
        this.name = 'ValidationError';
        this.code = 'VALIDATION_ERROR';
        this.errors = errors;
        this.timestamp = new Date().toISOString();
    }
}

export default BaseAPI;