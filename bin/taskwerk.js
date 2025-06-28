#!/usr/bin/env node

// This is the main executable that will be used when installed globally
// It simply imports and runs the main CLI module

import('../src/cli.js').catch(err => {
  console.error('Failed to load taskwerk:', err.message);
  process.exit(1);
});
