/**
 * TaskWerk v3 Validation Framework
 * 
 * Provides comprehensive validation schemas and utilities for all API operations
 */

/**
 * Common validation rules and schemas
 */

// Task status validation
export const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'completed', 'archived', 'error'];
export const TASK_PRIORITIES = ['high', 'medium', 'low'];
export const TASK_CATEGORIES = ['feature', 'bug', 'enhancement', 'documentation', 'testing', 'maintenance'];

// Task ID validation
export const TASK_ID_PATTERN = /^TASK-\d{3,}$/;

/**
 * Validation schemas for different entities
 */

export const TaskSchema = {
    required: ['name'],
    properties: {
        id: {
            type: 'number',
            min: 1
        },
        name: {
            type: 'string',
            minLength: 1,
            maxLength: 200
        },
        description: {
            type: 'string',
            maxLength: 2000
        },
        status: {
            type: 'string',
            enum: TASK_STATUSES
        },
        priority: {
            type: 'string',
            enum: TASK_PRIORITIES
        },
        category: {
            type: 'string',
            maxLength: 50
        },
        assignee: {
            type: 'string',
            maxLength: 100
        },
        estimated: {
            type: 'string',
            maxLength: 50
        },
        progress: {
            type: 'number',
            min: 0,
            max: 100
        },
        error_msg: {
            type: 'string',
            maxLength: 500
        },
        validation_state: {
            type: 'string',
            maxLength: 50
        }
    }
};

export const TaskDependencySchema = {
    required: ['task_id', 'depends_on_id'],
    properties: {
        task_id: {
            type: 'number',
            min: 1
        },
        depends_on_id: {
            type: 'number',
            min: 1
        },
        dependency_type: {
            type: 'string',
            enum: ['blocks', 'requires']
        }
    }
};

export const TaskNoteSchema = {
    required: ['task_id', 'note'],
    properties: {
        task_id: {
            type: 'number',
            min: 1
        },
        note: {
            type: 'string',
            minLength: 1,
            maxLength: 2000
        },
        note_type: {
            type: 'string',
            enum: ['comment', 'state_change', 'decision', 'reminder', 'system']
        },
        author: {
            type: 'string',
            maxLength: 100
        },
        agent_id: {
            type: 'string',
            maxLength: 100
        }
    }
};

export const TaskFileSchema = {
    required: ['task_id', 'file_path'],
    properties: {
        task_id: {
            type: 'number',
            min: 1
        },
        file_path: {
            type: 'string',
            minLength: 1,
            maxLength: 500
        },
        file_action: {
            type: 'string',
            enum: ['created', 'modified', 'deleted', 'renamed']
        },
        lines_added: {
            type: 'number',
            min: 0
        },
        lines_removed: {
            type: 'number',
            min: 0
        },
        description: {
            type: 'string',
            maxLength: 200
        }
    }
};

export const TaskKeywordSchema = {
    required: ['task_id', 'keyword'],
    properties: {
        task_id: {
            type: 'number',
            min: 1
        },
        keyword: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            validate: (value) => {
                // Keywords should be alphanumeric with hyphens/underscores
                if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                    return 'Keywords can only contain letters, numbers, hyphens, and underscores';
                }
                return null;
            }
        },
        keyword_type: {
            type: 'string',
            enum: ['tag', 'category', 'component', 'technology']
        }
    }
};

/**
 * Query parameter validation schemas
 */

export const ListTasksQuerySchema = {
    properties: {
        status: {
            type: 'string',
            enum: TASK_STATUSES
        },
        priority: {
            type: 'string', 
            enum: TASK_PRIORITIES
        },
        assignee: {
            type: 'string',
            maxLength: 100
        },
        category: {
            type: 'string',
            maxLength: 50
        },
        keyword: {
            type: 'string',
            maxLength: 50
        },
        limit: {
            type: 'number',
            min: 1,
            max: 1000
        },
        offset: {
            type: 'number',
            min: 0
        },
        sortBy: {
            type: 'string',
            enum: ['id', 'name', 'status', 'priority', 'created_at', 'updated_at']
        },
        sortOrder: {
            type: 'string',
            enum: ['asc', 'desc']
        }
    }
};

export const SearchQuerySchema = {
    required: ['query'],
    properties: {
        query: {
            type: 'string',
            minLength: 1,
            maxLength: 200
        },
        fields: {
            type: 'array',
            items: {
                type: 'string',
                enum: ['name', 'description', 'notes', 'keywords']
            }
        },
        limit: {
            type: 'number',
            min: 1,
            max: 100
        }
    }
};

/**
 * Validation utility functions
 */

/**
 * Validate task ID format (TASK-XXX)
 */
export function validateTaskId(taskId) {
    if (typeof taskId !== 'string') {
        throw new Error('Task ID must be a string');
    }
    
    if (!TASK_ID_PATTERN.test(taskId)) {
        throw new Error('Task ID must be in format TASK-XXX (e.g., TASK-001)');
    }
    
    return true;
}

/**
 * Validate circular dependency prevention
 */
export function validateNoCycles(taskId, dependsOnId, existingDependencies = []) {
    if (taskId === dependsOnId) {
        throw new Error('Task cannot depend on itself');
    }
    
    // Simple cycle detection - would need enhancement for complex cycles
    const directDependents = existingDependencies
        .filter(dep => dep.depends_on_id === taskId)
        .map(dep => dep.task_id);
    
    if (directDependents.includes(dependsOnId)) {
        throw new Error('Circular dependency detected');
    }
    
    return true;
}

/**
 * Validate date strings
 */
export function validateDate(dateString) {
    if (typeof dateString !== 'string') {
        throw new Error('Date must be a string');
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
    }
    
    return true;
}

/**
 * Validate file paths
 */
export function validateFilePath(filePath) {
    if (typeof filePath !== 'string') {
        throw new Error('File path must be a string');
    }
    
    // Basic file path validation
    if (filePath.includes('..') || filePath.includes('//')) {
        throw new Error('Invalid file path');
    }
    
    return true;
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query) {
    if (typeof query !== 'string') {
        throw new Error('Search query must be a string');
    }
    
    // Remove potentially harmful characters
    return query
        .replace(/[<>'"&]/g, '')
        .trim()
        .substring(0, 200);
}

/**
 * Create validation middleware for API methods
 */
export function createValidationMiddleware(schema) {
    return {
        before: async (methodName, params) => {
            // Import BaseAPI to use validation method
            const { BaseAPI } = await import('./base-api.js');
            const api = new BaseAPI();
            
            try {
                api.validate(params, schema);
            } catch (error) {
                throw error;
            }
        }
    };
}

/**
 * Bulk validation for arrays of data
 */
export async function validateBulk(items, schema) {
    const errors = [];
    
    if (!Array.isArray(items)) {
        throw new Error('Items must be an array');
    }
    
    for (let i = 0; i < items.length; i++) {
        try {
            const { BaseAPI } = await import('./base-api.js');
            const api = new BaseAPI();
            api.validate(items[i], schema);
        } catch (error) {
            errors.push({
                index: i,
                item: items[i],
                errors: error.errors || [error.message]
            });
        }
    }
    
    if (errors.length > 0) {
        const validationError = new Error('Bulk validation failed');
        validationError.name = 'BulkValidationError';
        validationError.errors = errors;
        throw validationError;
    }
    
    return true;
}

export default {
    TaskSchema,
    TaskDependencySchema,
    TaskNoteSchema,
    TaskFileSchema,
    TaskKeywordSchema,
    ListTasksQuerySchema,
    SearchQuerySchema,
    validateTaskId,
    validateNoCycles,
    validateDate,
    validateFilePath,
    sanitizeSearchQuery,
    createValidationMiddleware,
    validateBulk
};