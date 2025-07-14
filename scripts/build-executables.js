#!/usr/bin/env node
/**
 * Build platform-specific executables for Taskwerk
 * This script creates standalone executables that don't require Node.js
 * 
 * Note: This requires additional tooling like pkg, nexe, or similar
 * For now, this is a placeholder that documents the process
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

console.log(`Creating platform executables for taskwerk v${packageJson.version}...`);

// Create executables directory
mkdirSync('executables', { recursive: true });

// Platform configurations
const platforms = [
  {
    name: 'macos-arm64',
    target: 'node18-macos-arm64',
    output: 'taskwerk-macos-arm64',
    description: 'macOS (Apple Silicon)'
  },
  {
    name: 'macos-x64',
    target: 'node18-macos-x64', 
    output: 'taskwerk-macos-x64',
    description: 'macOS (Intel)'
  },
  {
    name: 'linux-x64',
    target: 'node18-linux-x64',
    output: 'taskwerk-linux-x64',
    description: 'Linux (64-bit)'
  },
  {
    name: 'linux-arm64',
    target: 'node18-linux-arm64',
    output: 'taskwerk-linux-arm64',
    description: 'Linux (ARM 64-bit)'
  },
  {
    name: 'windows-x64',
    target: 'node18-win-x64',
    output: 'taskwerk-win-x64.exe',
    description: 'Windows (64-bit)'
  }
];

// Check if pkg is available
try {
  execSync('npx pkg --version', { stdio: 'ignore' });
  console.log('✅ Found pkg executable builder');
} catch {
  console.error('❌ pkg is not available. To build executables, install it globally:');
  console.error('   npm install -g pkg');
  console.error('\nAlternatively, this script will use npx to run it.');
}

// Create a special entry point for pkg that handles native modules
const pkgEntryPoint = `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Set up global variables for package info
global.__PACKAGE_VERSION__ = "${packageJson.version}";
global.__PACKAGE_DESCRIPTION__ = "${packageJson.description}";
global.__PACKAGE_NAME__ = "${packageJson.name}";
global.__PACKAGE_AUTHOR__ = "${packageJson.author}";
global.__PACKAGE_LICENSE__ = "${packageJson.license}";

// Import the main CLI
import('../src/cli/index.js');
`;

writeFileSync('executables/pkg-entry.mjs', pkgEntryPoint);

// Create pkg configuration
const pkgConfig = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  bin: 'executables/pkg-entry.mjs',
  pkg: {
    assets: [
      'node_modules/better-sqlite3/build/Release/*.node',
      'node_modules/better-sqlite3/lib/**/*'
    ],
    targets: platforms.map(p => p.target),
    outputPath: 'executables'
  }
};

writeFileSync('executables/pkg-config.json', JSON.stringify(pkgConfig, null, 2));

// Build instructions
const buildInstructions = `
# Building Platform Executables

To build standalone executables for all platforms:

\`\`\`bash
# Install pkg globally (if not already installed)
npm install -g pkg

# Build for all platforms
npx pkg executables/pkg-entry.mjs --targets ${platforms.map(p => p.target).join(',')} --out-path executables

# Or build for specific platform
npx pkg executables/pkg-entry.mjs --targets node18-macos-arm64 --output executables/taskwerk-macos-arm64
\`\`\`

## Platform Targets

${platforms.map(p => `- **${p.description}**: ${p.target} → ${p.output}`).join('\n')}

## Notes

1. The executables will be larger (50-100MB) as they include Node.js runtime
2. Native modules like better-sqlite3 need to be compiled for each platform
3. Users won't need Node.js installed to run these executables
4. First run may be slower as native modules are extracted

## Alternative: Using nexe

\`\`\`bash
npm install -g nexe
nexe src/cli/index.js -t mac-x64-14.15.3 -o executables/taskwerk-macos-x64
\`\`\`

## Alternative: Using node-packer

\`\`\`bash
# More complex but produces smaller executables
# See: https://github.com/pmq20/node-packer
\`\`\`
`;

writeFileSync('executables/BUILD.md', buildInstructions);

console.log('\n📝 Created build configuration files:');
console.log('   - executables/pkg-entry.mjs (entry point)');
console.log('   - executables/pkg-config.json (pkg configuration)');
console.log('   - executables/BUILD.md (build instructions)');

console.log('\n💡 To build executables:');
console.log('   1. Install pkg: npm install -g pkg');
console.log('   2. Run: npm run build:exe');
console.log('\nNote: This is a placeholder. Actual executable building requires additional setup.');
console.log('See executables/BUILD.md for detailed instructions.');