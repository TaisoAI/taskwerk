import { Logger } from '../logging/logger.js';

export class QueryBuilder {
  constructor(db) {
    this.db = db;
    this.logger = new Logger('query-builder');
    this.reset();
  }

  reset() {
    this.table = null;
    this.selectFields = ['*'];
    this.whereConditions = [];
    this.whereValues = [];
    this.joinClauses = [];
    this.orderByClauses = [];
    this.limitValue = null;
    this.offsetValue = null;
    this.groupByFields = [];
    this.havingConditions = [];
    this.havingValues = [];
    return this;
  }

  /**
   * Set the table to query
   * @param {string} tableName - Table name
   * @returns {QueryBuilder}
   */
  from(tableName) {
    this.table = tableName;
    return this;
  }

  /**
   * Set fields to select
   * @param {...string} fields - Field names
   * @returns {QueryBuilder}
   */
  select(...fields) {
    this.selectFields = fields.length > 0 ? fields : ['*'];
    return this;
  }

  /**
   * Add WHERE condition
   * @param {string} field - Field name
   * @param {string} operator - Operator (=, !=, >, <, >=, <=, LIKE, IN)
   * @param {*} value - Value to compare
   * @returns {QueryBuilder}
   */
  where(field, operator, value) {
    if (operator === 'IN' && Array.isArray(value)) {
      const placeholders = value.map(() => '?').join(', ');
      this.whereConditions.push(`${field} ${operator} (${placeholders})`);
      this.whereValues.push(...value);
    } else {
      this.whereConditions.push(`${field} ${operator} ?`);
      this.whereValues.push(value);
    }
    return this;
  }

  /**
   * Add WHERE condition with AND
   * @param {string} field - Field name
   * @param {string} operator - Operator
   * @param {*} value - Value to compare
   * @returns {QueryBuilder}
   */
  andWhere(field, operator, value) {
    return this.where(field, operator, value);
  }

  /**
   * Add WHERE condition with OR
   * @param {string} field - Field name
   * @param {string} operator - Operator
   * @param {*} value - Value to compare
   * @returns {QueryBuilder}
   */
  orWhere(field, operator, value) {
    if (this.whereConditions.length === 0) {
      return this.where(field, operator, value);
    }

    // Add OR condition with special prefix
    if (operator === 'IN' && Array.isArray(value)) {
      const placeholders = value.map(() => '?').join(', ');
      this.whereConditions.push(`OR ${field} ${operator} (${placeholders})`);
      this.whereValues.push(...value);
    } else {
      this.whereConditions.push(`OR ${field} ${operator} ?`);
      this.whereValues.push(value);
    }

    return this;
  }

  /**
   * Add LIKE condition for text search
   * @param {string} field - Field name
   * @param {string} pattern - Search pattern
   * @returns {QueryBuilder}
   */
  like(field, pattern) {
    return this.where(field, 'LIKE', `%${pattern}%`);
  }

  /**
   * Add IS NULL condition
   * @param {string} field - Field name
   * @returns {QueryBuilder}
   */
  whereNull(field) {
    this.whereConditions.push(`${field} IS NULL`);
    return this;
  }

  /**
   * Add IS NOT NULL condition
   * @param {string} field - Field name
   * @returns {QueryBuilder}
   */
  whereNotNull(field) {
    this.whereConditions.push(`${field} IS NOT NULL`);
    return this;
  }

  /**
   * Add date range condition
   * @param {string} field - Date field name
   * @param {string} startDate - Start date (ISO string)
   * @param {string} endDate - End date (ISO string)
   * @returns {QueryBuilder}
   */
  whereDateBetween(field, startDate, endDate) {
    this.whereConditions.push(`${field} BETWEEN ? AND ?`);
    this.whereValues.push(startDate, endDate);
    return this;
  }

  /**
   * Add JOIN clause
   * @param {string} table - Table to join
   * @param {string} condition - Join condition
   * @param {string} type - Join type (INNER, LEFT, RIGHT)
   * @returns {QueryBuilder}
   */
  join(table, condition, type = 'INNER') {
    this.joinClauses.push(`${type} JOIN ${table} ON ${condition}`);
    return this;
  }

  /**
   * Add LEFT JOIN clause
   * @param {string} table - Table to join
   * @param {string} condition - Join condition
   * @returns {QueryBuilder}
   */
  leftJoin(table, condition) {
    return this.join(table, condition, 'LEFT');
  }

  /**
   * Add ORDER BY clause
   * @param {string} field - Field name
   * @param {string} direction - ASC or DESC
   * @returns {QueryBuilder}
   */
  orderBy(field, direction = 'ASC') {
    this.orderByClauses.push(`${field} ${direction.toUpperCase()}`);
    return this;
  }

  /**
   * Add GROUP BY clause
   * @param {...string} fields - Field names
   * @returns {QueryBuilder}
   */
  groupBy(...fields) {
    this.groupByFields.push(...fields);
    return this;
  }

  /**
   * Add HAVING condition
   * @param {string} condition - Having condition
   * @param {*} value - Value (optional)
   * @returns {QueryBuilder}
   */
  having(condition, value = null) {
    this.havingConditions.push(condition);
    if (value !== null) {
      this.havingValues.push(value);
    }
    return this;
  }

  /**
   * Set LIMIT
   * @param {number} count - Limit count
   * @returns {QueryBuilder}
   */
  limit(count) {
    this.limitValue = parseInt(count);
    return this;
  }

  /**
   * Set OFFSET
   * @param {number} count - Offset count
   * @returns {QueryBuilder}
   */
  offset(count) {
    this.offsetValue = parseInt(count);
    return this;
  }

  /**
   * Add pagination
   * @param {number} page - Page number (1-based)
   * @param {number} perPage - Items per page
   * @returns {QueryBuilder}
   */
  paginate(page, perPage) {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(perPage));
    this.limitValue = limitNum;
    this.offsetValue = (pageNum - 1) * limitNum;
    return this;
  }

  /**
   * Build the SQL query
   * @returns {Object} SQL string and values
   */
  buildQuery() {
    if (!this.table) {
      throw new Error('Table not specified');
    }

    let sql = `SELECT ${this.selectFields.join(', ')} FROM ${this.table}`;

    // Add JOINs
    if (this.joinClauses.length > 0) {
      sql += ` ${this.joinClauses.join(' ')}`;
    }

    // Add WHERE
    if (this.whereConditions.length > 0) {
      // Build WHERE clause with proper OR/AND handling
      let whereClause = '';

      for (let i = 0; i < this.whereConditions.length; i++) {
        const condition = this.whereConditions[i];

        if (i === 0) {
          // First condition - check if we need parentheses for OR grouping
          if (
            i + 1 < this.whereConditions.length &&
            this.whereConditions[i + 1].toString().startsWith('OR ')
          ) {
            whereClause = `(${condition})`;
          } else {
            whereClause = condition;
          }
        } else if (condition.toString().startsWith('OR ')) {
          // OR condition - remove OR prefix and wrap in parentheses
          const cleanCondition = condition.substring(3);
          whereClause += ` OR (${cleanCondition})`;
        } else {
          // AND condition
          whereClause += ` AND ${condition}`;
        }
      }

      sql += ` WHERE ${whereClause}`;
    }

    // Add GROUP BY
    if (this.groupByFields.length > 0) {
      sql += ` GROUP BY ${this.groupByFields.join(', ')}`;
    }

    // Add HAVING
    if (this.havingConditions.length > 0) {
      sql += ` HAVING ${this.havingConditions.join(' AND ')}`;
    }

    // Add ORDER BY
    if (this.orderByClauses.length > 0) {
      sql += ` ORDER BY ${this.orderByClauses.join(', ')}`;
    }

    // Add LIMIT and OFFSET
    if (this.limitValue !== null && !isNaN(this.limitValue)) {
      sql += ` LIMIT ${this.limitValue}`;
    }
    if (this.offsetValue !== null && !isNaN(this.offsetValue)) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return {
      sql,
      values: [...this.whereValues, ...this.havingValues],
    };
  }

  /**
   * Execute the query and return all results
   * @returns {Array} Query results
   */
  get() {
    const { sql, values } = this.buildQuery();

    try {
      const stmt = this.db.prepare(sql);
      const results = stmt.all(...values);
      this.logger.debug(`Query executed: ${sql}`, { rowCount: results.length });
      return results;
    } catch (error) {
      this.logger.error(`Query failed: ${sql}`, error);
      throw error;
    }
  }

  /**
   * Execute the query and return first result
   * @returns {Object|null} First result or null
   */
  first() {
    this.limit(1);
    const results = this.get();
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Execute the query and return count
   * @returns {number} Count of results
   */
  count() {
    const originalSelect = [...this.selectFields];
    this.select('COUNT(*) as count');

    const result = this.first();
    this.selectFields = originalSelect;

    return result ? result.count : 0;
  }

  /**
   * Check if any results exist
   * @returns {boolean} True if results exist
   */
  exists() {
    return this.count() > 0;
  }
}

/**
 * Create a new query builder instance
 * @param {Object} db - Database connection
 * @returns {QueryBuilder}
 */
export function query(db) {
  return new QueryBuilder(db);
}
