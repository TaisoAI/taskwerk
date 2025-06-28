#!/usr/bin/env node

import { build } from 'esbuild';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function printBanner() {
  const now = new Date();
  console.log('────────────────────────────────────────────────────────────');
  console.log('📦 TaskWerk v0.1.0');
  console.log(`⏰ ${now.toISOString()}`);
  console.log('🗜️ Building minified bundle...');
  console.log('────────────────────────────────────────────────────────────');
}

function printSuccess() {
  const now = new Date();
  console.log('────────────────────────────────────────────────────────────');
  console.log('✅ TaskWerk v0.1.0 - minified bundle built successfully');
  console.log(`⏰ ${now.toISOString()}`);
  console.log('────────────────────────────────────────────────────────────');
}

function printError(error) {
  const now = new Date();
  console.log('────────────────────────────────────────────────────────────');
  console.log('❌ TaskWerk v0.1.0 - minified bundle build failed');
  console.log(`⏰ ${now.toISOString()}`);
  console.log(`Error: ${error.message}`);
  console.log('────────────────────────────────────────────────────────────');
}

async function ensureDistDir() {
  try {
    await fs.access(join(projectRoot, 'dist'));
  } catch (error) {
    await fs.mkdir(join(projectRoot, 'dist'), { recursive: true });
  }
}

async function buildMinified() {
  try {
    printBanner();
    
    // Ensure dist directory exists
    await ensureDistDir();
    
    // Build minified bundle
    await build({
      entryPoints: [join(projectRoot, 'bin/taskwerk.js')],
      bundle: true,
      minify: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: join(projectRoot, 'dist/taskwerk.min.js'),
      packages: 'external' // Keep node built-ins as external
    });
    
    // Fix shebang line - remove duplicates and ensure exactly one at the start
    const minifiedPath = join(projectRoot, 'dist/taskwerk.min.js');
    let content = await fs.readFile(minifiedPath, 'utf8');
    
    // Remove all shebang lines
    content = content.replace(/^#!\/usr\/bin\/env node\n/gm, '');
    
    // Add exactly one shebang line at the beginning
    content = `#!/usr/bin/env node\n${content}`;
    
    await fs.writeFile(minifiedPath, content);
    
    // Make the minified file executable
    await fs.chmod(minifiedPath, 0o755);
    
    // Show file size
    const stats = await fs.stat(join(projectRoot, 'dist/taskwerk.min.js'));
    const sizeInKB = (stats.size / 1024).toFixed(2);
    console.log(`\n📁 Built minified bundle:`);
    console.log(`   taskwerk.min.js (${sizeInKB} KB)`);
    console.log(`\n💡 Usage:`);
    console.log(`   node dist/taskwerk.min.js --help`);
    console.log(`   ./dist/taskwerk.min.js --help`);
    
    printSuccess();
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    printError(error);
    process.exit(1);
  }
}

buildMinified();