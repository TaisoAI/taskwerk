/**
 * Output Utilities
 * 
 * @description Helper functions for CLI output formatting
 * @module taskwerk/cli/utils/output
 */

import chalk from 'chalk';

/**
 * Handle error output
 * @param {Error|string} error - Error to display
 */
export function handleError(error) {
  const message = error instanceof Error ? error.message : error;
  console.error(chalk.red('✗'), message);
}

/**
 * Handle success output
 * @param {string} message - Success message
 */
export function handleSuccess(message) {
  console.log(chalk.green('✓'), message);
}

/**
 * Handle info output
 * @param {string} message - Info message
 */
export function handleInfo(message) {
  console.log(chalk.blue('ℹ'), message);
}

/**
 * Handle warning output
 * @param {string} message - Warning message
 */
export function handleWarning(message) {
  console.log(chalk.yellow('⚠'), message);
}