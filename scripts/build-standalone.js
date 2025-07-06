#!/usr/bin/env node

/**
 * Build standalone script for Taskwerk
 * Creates a fully self-contained executable
 */

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

async function build() {
  console.log('Building standalone Taskwerk...');

  try {
    // Read package.json to embed version info
    const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
    
    // Create a plugin to inject package info
    const injectPackageInfo = {
      name: 'inject-package-info',
      setup(build) {
        build.onResolve({ filter: /package\.json$/ }, args => {
          if (args.path.includes('package.json')) {
            return { path: 'virtual:package.json', namespace: 'package-json' };
          }
        });
        
        build.onLoad({ filter: /.*/, namespace: 'package-json' }, () => {
          return {
            contents: JSON.stringify({
              name: packageJson.name,
              version: packageJson.version,
              description: packageJson.description,
              author: packageJson.author,
              license: packageJson.license
            }),
            loader: 'json',
          };
        });
      }
    };

    // Build the CLI into a single file
    const result = await esbuild.build({
      entryPoints: [join(projectRoot, 'src/cli/index.js')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: join(projectRoot, 'dist/taskwerk-standalone.js'),
      minify: false, // Keep it readable for debugging
      sourcemap: false,
      // Bundle everything except native modules
      external: ['better-sqlite3'],
      plugins: [injectPackageInfo],
      define: {
        '__PACKAGE_VERSION__': JSON.stringify(packageJson.version),
        '__PACKAGE_NAME__': JSON.stringify(packageJson.name),
        '__PACKAGE_DESCRIPTION__': JSON.stringify(packageJson.description)
      }
    });

    // Read the built file and add shebang
    const outputPath = join(projectRoot, 'dist/taskwerk-standalone.js');
    let content = readFileSync(outputPath, 'utf8');
    
    // Ensure shebang is at the very top
    if (!content.startsWith('#!/usr/bin/env node')) {
      content = '#!/usr/bin/env node\n' + content;
    }
    
    // Write it back
    writeFileSync(outputPath, content);

    // Get file size
    const { statSync } = await import('fs');
    const stats = statSync(outputPath);
    
    console.log('✅ Build complete!');
    console.log(`📦 Output: dist/taskwerk-standalone.js`);
    console.log(`📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run the build
build();