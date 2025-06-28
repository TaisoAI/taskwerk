#!/usr/bin/env node

import { spawn } from 'child_process';
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
  console.log('🔨 Building executables...');
  console.log('────────────────────────────────────────────────────────────');
}

function printSuccess() {
  const now = new Date();
  console.log('────────────────────────────────────────────────────────────');
  console.log('✅ TaskWerk v0.1.0 - executables built successfully');
  console.log(`⏰ ${now.toISOString()}`);
  console.log('────────────────────────────────────────────────────────────');
}

function printError(code) {
  const now = new Date();
  console.log('────────────────────────────────────────────────────────────');
  console.log(`❌ TaskWerk v0.1.0 - executable build failed (exit code: ${code})`);
  console.log(`⏰ ${now.toISOString()}`);
  console.log('────────────────────────────────────────────────────────────');
}

async function ensureDistDir() {
  try {
    await fs.access(join(projectRoot, 'dist'));
  } catch (error) {
    await fs.mkdir(join(projectRoot, 'dist'), { recursive: true });
  }
}

function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${command} ${args.join(' ')}`);
    
    const childProcess = spawn(command, args, {
      stdio: 'inherit',
      cwd: projectRoot,
      shell: process.platform === 'win32'
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    childProcess.on('error', (error) => {
      reject(error);
    });
  });
}

async function buildExecutables() {
  try {
    printBanner();
    
    // Ensure dist directory exists
    await ensureDistDir();
    
    // Run pkg to build executables for all targets
    await runCommand('npx', ['pkg', '.', '--out-path', 'dist']);
    
    // List the built executables
    console.log('\n📁 Built executables:');
    try {
      const distFiles = await fs.readdir(join(projectRoot, 'dist'));
      for (const file of distFiles) {
        const stats = await fs.stat(join(projectRoot, 'dist', file));
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`   ${file} (${sizeInMB} MB)`);
      }
    } catch (error) {
      console.log('   No executables found in dist/');
    }
    
    printSuccess();
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    printError(1);
    process.exit(1);
  }
}

buildExecutables();