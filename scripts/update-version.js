#!/usr/bin/env node

/**
 * Update version script
 * Reads version from package.json and creates src/version.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Read package.json
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

// Create version.js content
const versionContent = `/**
 * Auto-generated version file
 * DO NOT EDIT MANUALLY
 * Generated: ${new Date().toISOString()}
 */

export const VERSION = '${packageJson.version}';
export const NAME = '${packageJson.name}';
export const DESCRIPTION = '${packageJson.description}';
export const AUTHOR = '${packageJson.author}';
export const LICENSE = '${packageJson.license}';

export default {
  VERSION,
  NAME,
  DESCRIPTION,
  AUTHOR,
  LICENSE
};
`;

// Write to src/version.js
const versionPath = join(projectRoot, 'src/version.js');
writeFileSync(versionPath, versionContent, 'utf8');

console.log(`✅ Updated src/version.js with version ${packageJson.version}`);