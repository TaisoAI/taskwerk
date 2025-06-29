#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion() {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    return 'unknown';
  }
}

function getTimestamp() {
  return new Date().toISOString();
}

const version = getVersion();
const timestamp = getTimestamp();
const action = process.argv[2] || 'running';

console.log('─'.repeat(60));
console.log(`📦 taskwerk v${version}`);
console.log(`⏰ ${timestamp}`);
console.log(`🚀 ${action.charAt(0).toUpperCase() + action.slice(1)}...`);
console.log('─'.repeat(60));