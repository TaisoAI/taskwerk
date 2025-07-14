import { build } from 'esbuild';
import { readFileSync, chmodSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

console.log(`Building taskwerk v${packageJson.version}...`);

// Create dist directory
mkdirSync('dist', { recursive: true });

try {
  // Build everything into a single file
  await build({
    entryPoints: ['src/cli/index.js'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: 'dist/taskwerk.js',
    minify: true,
    sourcemap: false,
    metafile: true,
    // Keep these external - they have native bindings or special requirements
    external: [
      'better-sqlite3',
      'inquirer',
      'chalk',
      'commander',
      'yaml',
      'uuid'
    ],
    banner: {
      js: `#!/usr/bin/env node
/**
 * Taskwerk v${packageJson.version}
 * ${packageJson.description}
 * 
 * Copyright (c) ${new Date().getFullYear()} ${packageJson.author}
 * Licensed under the ${packageJson.license} license
 * 
 * This CLI requires: better-sqlite3, inquirer, chalk, commander, yaml
 * Install with: npm install -g taskwerk
 */

// Dependency check
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const deps = ['better-sqlite3', 'inquirer', 'chalk', 'commander', 'yaml'];
const missing = deps.filter(d => {
  try { require.resolve(d); return false; } 
  catch { return true; }
});
if (missing.length) {
  console.error('\\x1b[31mError: Missing dependencies:\\x1b[0m', missing.join(', '));
  console.error('\\nInstall with: npm install -g taskwerk');
  process.exit(1);
}

// Package info
global.__PACKAGE_VERSION__ = "${packageJson.version}";
global.__PACKAGE_DESCRIPTION__ = "${packageJson.description}";
global.__PACKAGE_NAME__ = "${packageJson.name}";
global.__PACKAGE_AUTHOR__ = "${packageJson.author}";
global.__PACKAGE_LICENSE__ = "${packageJson.license}";
`
    }
  });

  // Make executable
  chmodSync('dist/taskwerk.js', 0o755);

  // Calculate final size
  const finalSize = readFileSync('dist/taskwerk.js').length;
  
  console.log('Build completed successfully!');
  console.log(`Created executable: dist/taskwerk.js (${(finalSize / 1024).toFixed(2)} KB)`);

} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}