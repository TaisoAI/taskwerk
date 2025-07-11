import { build } from 'esbuild';
import { readFileSync, chmodSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

console.log(`Building taskwerk v${packageJson.version}...`);

// For now, create a simple executable wrapper instead of bundling
// This avoids ESM/CJS compatibility issues
const wrapperContent = `#!/usr/bin/env node
import '../src/cli/index.js';
`;

try {
  // Create the dist directory if it doesn't exist
  const { mkdirSync } = await import('fs');
  mkdirSync('dist', { recursive: true });
  
  // Write the wrapper file
  writeFileSync('dist/taskwerk.js', wrapperContent);
  
  // Make the output file executable
  chmodSync('dist/taskwerk.js', 0o755);
  
  console.log('Build completed successfully!');
  console.log('Created executable: dist/taskwerk.js');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}