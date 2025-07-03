/**
 * TaskWerk v3 Database Initialization
 * 
 * Handles database creation, schema initialization, and validation
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import {
    ALL_TABLES,
    INDEXES,
    TRIGGERS,
    DEFAULT_DATA,
    VALIDATION_QUERIES,
    SCHEMA_VERSION
} from './schema.js';

/**
 * Database initialization class
 */
export class DatabaseInitializer {
    constructor(dbPath = null) {
        this.dbPath = dbPath || this.getDefaultDbPath();
        this.db = null;
    }

    /**
     * Get default database path
     */
    getDefaultDbPath() {
        // Default to taskwerk.db in current working directory
        return join(process.cwd(), 'taskwerk.db');
    }

    /**
     * Ensure database directory exists
     */
    ensureDbDirectory() {
        const dbDir = dirname(this.dbPath);
        if (!existsSync(dbDir)) {
            mkdirSync(dbDir, { recursive: true });
        }
    }

    /**
     * Initialize database connection
     */
    connect() {
        try {
            this.ensureDbDirectory();
            
            // Create database connection with performance optimizations
            this.db = new Database(this.dbPath, {
                verbose: process.env.DEBUG_SQL ? console.log : null
            });

            // Enable WAL mode for better concurrency
            this.db.pragma('journal_mode = WAL');
            
            // Enable foreign key constraints
            this.db.pragma('foreign_keys = ON');
            
            // Set reasonable cache size (16MB)
            this.db.pragma('cache_size = 16384');
            
            // Set synchronous mode for better performance
            this.db.pragma('synchronous = NORMAL');
            
            return this.db;
        } catch (error) {
            throw new Error(`Failed to connect to database: ${error.message}`);
        }
    }

    /**
     * Check if database exists and is initialized
     */
    isInitialized() {
        if (!existsSync(this.dbPath)) {
            return false;
        }

        try {
            if (!this.db) {
                this.connect();
            }

            // Check if schema_meta table exists and has version
            const result = this.db.prepare(
                "SELECT value FROM schema_meta WHERE key = 'version'"
            ).get();

            return result && result.value === SCHEMA_VERSION;
        } catch (error) {
            return false;
        }
    }

    /**
     * Create all database tables
     */
    createTables() {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        console.log('Creating database tables...');
        
        // Create tables in dependency order
        for (const tableSQL of ALL_TABLES) {
            try {
                this.db.exec(tableSQL);
            } catch (error) {
                throw new Error(`Failed to create table: ${error.message}`);
            }
        }

        console.log(`Created ${ALL_TABLES.length} tables`);
    }

    /**
     * Create database indexes for performance
     */
    createIndexes() {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        console.log('Creating database indexes...');
        
        for (const indexSQL of INDEXES) {
            try {
                this.db.exec(indexSQL);
            } catch (error) {
                throw new Error(`Failed to create index: ${error.message}`);
            }
        }

        console.log(`Created ${INDEXES.length} indexes`);
    }

    /**
     * Create database triggers
     */
    createTriggers() {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        console.log('Creating database triggers...');
        
        for (const triggerSQL of TRIGGERS) {
            try {
                this.db.exec(triggerSQL);
            } catch (error) {
                throw new Error(`Failed to create trigger: ${error.message}`);
            }
        }

        console.log(`Created ${TRIGGERS.length} triggers`);
    }

    /**
     * Insert default data
     */
    insertDefaultData() {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        console.log('Inserting default data...');
        
        for (const dataSet of DEFAULT_DATA) {
            const { table, data } = dataSet;
            
            for (const record of data) {
                try {
                    const columns = Object.keys(record).join(', ');
                    const placeholders = Object.keys(record).map(() => '?').join(', ');
                    const values = Object.values(record);
                    
                    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
                    this.db.prepare(sql).run(...values);
                } catch (error) {
                    // Ignore duplicate key errors for default data
                    if (!error.message.includes('UNIQUE constraint failed')) {
                        throw new Error(`Failed to insert default data into ${table}: ${error.message}`);
                    }
                }
            }
        }

        console.log('Default data inserted');
    }

    /**
     * Validate database schema
     */
    validateSchema() {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        console.log('Validating database schema...');
        
        for (const query of VALIDATION_QUERIES) {
            try {
                const result = this.db.prepare(query).get();
                if (result.count === 0) {
                    throw new Error(`Schema validation failed: ${query}`);
                }
            } catch (error) {
                throw new Error(`Schema validation error: ${error.message}`);
            }
        }

        console.log('Schema validation passed');
    }

    /**
     * Get database statistics
     */
    getStats() {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        const stats = {
            version: SCHEMA_VERSION,
            tables: {},
            size: null,
            indexes: INDEXES.length,
            triggers: TRIGGERS.length
        };

        // Count records in each main table
        const tables = ['tasks', 'task_dependencies', 'task_notes', 'task_files', 'task_keywords'];
        for (const table of tables) {
            try {
                const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
                stats.tables[table] = result.count;
            } catch (error) {
                stats.tables[table] = 'error';
            }
        }

        // Get database file size if possible
        try {
            const result = this.db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get();
            stats.size = result.size;
        } catch (error) {
            // Size calculation failed, not critical
        }

        return stats;
    }

    /**
     * Initialize complete database
     */
    async initialize(force = false) {
        try {
            // Check if already initialized
            if (!force && this.isInitialized()) {
                console.log('Database already initialized');
                return { success: true, created: false, stats: this.getStats() };
            }

            // Connect to database
            this.connect();

            // Begin transaction for atomic initialization
            const transaction = this.db.transaction(() => {
                this.createTables();
                this.createIndexes();
                this.createTriggers();
                this.insertDefaultData();
                this.validateSchema();
            });

            // Execute initialization transaction
            transaction();

            const stats = this.getStats();
            console.log('Database initialized successfully');
            console.log('Stats:', JSON.stringify(stats, null, 2));

            return { 
                success: true, 
                created: true, 
                path: this.dbPath,
                stats 
            };

        } catch (error) {
            console.error('Database initialization failed:', error.message);
            
            // Clean up on failure
            if (this.db) {
                this.db.close();
                this.db = null;
            }

            throw error;
        }
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * Get database connection
     */
    getConnection() {
        if (!this.db) {
            this.connect();
        }
        return this.db;
    }
}

/**
 * Convenience function to initialize database
 */
export async function initializeDatabase(dbPath = null, force = false) {
    const initializer = new DatabaseInitializer(dbPath);
    return await initializer.initialize(force);
}

/**
 * Convenience function to get database connection
 */
export function getDatabaseConnection(dbPath = null) {
    const initializer = new DatabaseInitializer(dbPath);
    return initializer.getConnection();
}

export default DatabaseInitializer;