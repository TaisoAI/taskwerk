/**
 * Simple obfuscation for API keys
 * This is NOT secure encryption, just basic obfuscation to avoid plain text storage
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Use a static key derived from the app name and version
// This is not secure but better than plain text
const APP_KEY = Buffer.from('taskwerk-config-obfuscation-2024', 'utf8').slice(0, 32);
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Obfuscate a string value
 * @param {string} text - The text to obfuscate
 * @returns {string} - Base64 encoded obfuscated text with IV prepended
 */
export function obfuscate(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, APP_KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Prepend IV to the encrypted data
    const combined = Buffer.concat([iv, Buffer.from(encrypted, 'hex')]);

    // Add a marker to identify obfuscated values
    return `@obf:${combined.toString('base64')}`;
  } catch (error) {
    // If obfuscation fails, return original (better than losing the key)
    console.warn('Failed to obfuscate value:', error.message);
    return text;
  }
}

/**
 * Deobfuscate a string value
 * @param {string} text - The obfuscated text
 * @returns {string} - The original text
 */
export function deobfuscate(text) {
  if (!text || typeof text !== 'string' || !text.startsWith('@obf:')) {
    return text;
  }

  try {
    // Remove the marker
    const encoded = text.slice(5);
    const combined = Buffer.from(encoded, 'base64');

    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, APP_KEY, iv);

    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // If deobfuscation fails, return original (might be corrupted)
    console.warn('Failed to deobfuscate value:', error.message);
    return text;
  }
}

/**
 * Check if a value is obfuscated
 * @param {string} value - The value to check
 * @returns {boolean} - True if the value is obfuscated
 */
export function isObfuscated(value) {
  return typeof value === 'string' && value.startsWith('@obf:');
}

/**
 * Obfuscate sensitive fields in an object
 * @param {object} obj - The object to process
 * @param {string[]} sensitiveFields - Array of field paths to obfuscate
 * @returns {object} - New object with obfuscated fields
 */
export function obfuscateObject(obj, sensitiveFields) {
  const result = JSON.parse(JSON.stringify(obj)); // Deep clone

  for (const field of sensitiveFields) {
    const parts = field.split('.');
    let target = result;

    for (let i = 0; i < parts.length - 1; i++) {
      if (target[parts[i]]) {
        target = target[parts[i]];
      } else {
        break;
      }
    }

    const lastPart = parts[parts.length - 1];
    if (target && target[lastPart] && !isObfuscated(target[lastPart])) {
      target[lastPart] = obfuscate(target[lastPart]);
    }
  }

  return result;
}

/**
 * Deobfuscate sensitive fields in an object
 * @param {object} obj - The object to process
 * @param {string[]} sensitiveFields - Array of field paths to deobfuscate
 * @returns {object} - New object with deobfuscated fields
 */
export function deobfuscateObject(obj, sensitiveFields) {
  const result = JSON.parse(JSON.stringify(obj)); // Deep clone

  for (const field of sensitiveFields) {
    const parts = field.split('.');
    let target = result;

    for (let i = 0; i < parts.length - 1; i++) {
      if (target[parts[i]]) {
        target = target[parts[i]];
      } else {
        break;
      }
    }

    const lastPart = parts[parts.length - 1];
    if (target && target[lastPart] && isObfuscated(target[lastPart])) {
      target[lastPart] = deobfuscate(target[lastPart]);
    }
  }

  return result;
}
