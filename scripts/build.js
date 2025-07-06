#!/usr/bin/env node

/**
 * Build script for Taskwerk
 * Creates a minified single-file executable
 */

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

async function build() {
  console.log('Building Taskwerk...');

  try {
    // Update version.js first
    await import('./update-version.js');
    // Build the CLI into a single file
    const result = await esbuild.build({
      entryPoints: [join(projectRoot, 'src/cli/index.js')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: join(projectRoot, 'dist/taskwerk.js'),
      minify: true,
      sourcemap: false,
      // Mark all dependencies as external to keep the bundle smaller
      external: ['better-sqlite3', 'chalk', 'commander', 'yaml'],
      define: {
        'import.meta.url': 'import.meta.url'
      }
    });

    // Make the output file executable
    const outputPath = join(projectRoot, 'dist/taskwerk.js');
    
    // Read the built file
    let content = readFileSync(outputPath, 'utf8');
    
    // Ensure shebang is at the very top
    if (!content.startsWith('#!/usr/bin/env node')) {
      content = '#!/usr/bin/env node\n' + content;
    }
    
    // Write it back
    writeFileSync(outputPath, content);

    // Also create a package.json for the dist
    const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
    const distPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      author: packageJson.author,
      license: packageJson.license,
      type: 'module',
      main: './taskwerk.js',
      bin: {
        taskwerk: './taskwerk.js',
        twrk: './taskwerk.js'
      },
      dependencies: packageJson.dependencies
    };

    writeFileSync(
      join(projectRoot, 'dist/package.json'),
      JSON.stringify(distPackageJson, null, 2)
    );

    // Get file size
    const { statSync } = await import('fs');
    const stats = statSync(outputPath);
    
    console.log('✅ Build complete!');
    console.log(`📦 Output: dist/taskwerk.js`);
    console.log(`📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run the build
build();