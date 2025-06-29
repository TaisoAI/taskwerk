# TaskWerk Build and Test Guide

This document provides comprehensive instructions for building and testing TaskWerk properly.

## Overview

TaskWerk uses a Node.js-based build system with ESBuild for minification, ESLint for linting, Prettier for formatting, and Node.js built-in test runner for testing.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher (specified in `package.json` engines)
- **npm**: Comes with Node.js installation
- **Git**: Required for TaskWerk's git integration features

## Project Structure

```
taskwerk/
├── bin/                    # Executable scripts
│   └── taskwerk.js        # Main CLI entry point
├── src/                   # Source code
│   ├── commands/          # CLI commands
│   ├── core/             # Core functionality
│   ├── git/              # Git integration
│   ├── llm/              # LLM integration
│   └── utils/            # Utilities
├── tests/                # Test files
│   ├── commands/         # Command tests
│   ├── core/            # Core tests
│   ├── dist/            # Build artifact tests
│   ├── git/             # Git integration tests
│   └── utils/           # Utility tests
├── scripts/             # Build scripts
├── dist/                # Built artifacts (created during build)
│   └── taskwerk.min.js  # Minified bundle
└── docs/                # Documentation
```

## Available Commands

### Development Commands

- `npm start` - Run TaskWerk CLI directly
- `npm run dev` - Alias for start (development mode)

### Build Commands

- `npm run build` - Full build with linting, formatting, tests, and minified bundle
- `npm run build:minified` - Build only the minified bundle
- `npm run build:all` - Build everything (same as build + build:minified)
- `npm run make-release-dry-run` - Comprehensive pre-release validation

### Code Quality Commands

- `npm run lint` - Run ESLint on src/, tests/, and bin/
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check if code is properly formatted

### Test Commands

- `npm test` - Run all tests with the custom test runner
- `npm run test:watch` - Run tests in watch mode (Node.js built-in)

### Maintenance Commands

- `npm run clean` - Remove build artifacts and temporary files
- `npm run prepack` - Pre-publish validation (lint + format + test)
- `npm run prepublishOnly` - Runs prepack before npm publish

## Build Process Details

### 1. Full Build (`npm run build`)

The build process follows this sequence:

1. **Version Banner** - Shows build start info
2. **Linting** - ESLint checks for code quality issues
3. **Format Check** - Prettier validates code formatting
4. **Tests** - Runs complete test suite (171 tests)
5. **Minified Bundle** - Creates optimized single-file bundle
6. **Success Banner** - Shows build completion

### 2. Minified Build (`npm run build:minified`)

Creates a single optimized file at `dist/taskwerk.min.js`:

- **Bundling**: ESBuild bundles all dependencies
- **Minification**: Code is minified for smaller size
- **Platform**: Targets Node.js 18+
- **Format**: ES modules
- **Shebang**: Adds `#!/usr/bin/env node` for direct execution
- **Permissions**: Makes file executable (755)

The minified build:
- Size: ~107KB
- Executable: `./dist/taskwerk.min.js --help`
- Portable: Can run without npm installation

## Testing Framework

TaskWerk uses Node.js built-in test runner with comprehensive test coverage:

### Test Organization

- **171 total tests** across 54 test suites
- **0 failures** required for build success
- **7 skipped tests** (interactive features that can't be automated)

### Test Categories

1. **Command Tests** (`tests/commands/`)
   - CLI command functionality
   - Option parsing and validation
   - Error handling

2. **Core Tests** (`tests/core/`)
   - Task management logic
   - Session management
   - Workflow rules
   - Task parsing

3. **Integration Tests** (`tests/git/`, `tests/utils/`)
   - Git integration
   - Configuration management
   - Utility functions

4. **Build Tests** (`tests/dist/`)
   - Minified bundle functionality
   - Executable permissions
   - Cross-platform compatibility

### Running Tests

```bash
# Run all tests
npm test

# Run tests with verbose output
node --test tests/**/*.test.js --reporter=spec

# Run specific test file
node --test tests/commands/llmconfig.test.js

# Run tests in watch mode
npm run test:watch
```

### Test Requirements for Commit

All tests must pass before committing:
- 171 tests passing
- 0 failures
- No new test failures introduced

## Code Quality Standards

### ESLint Configuration

- **Target**: ES2022+ with ES modules
- **Rules**: Standard JavaScript linting rules
- **Coverage**: src/, tests/, and bin/ directories
- **Zero tolerance**: Build fails on any linting errors

### Prettier Configuration

- **Style**: Consistent code formatting
- **Coverage**: All JavaScript files
- **Integration**: Pre-commit formatting checks
- **Auto-fix**: `npm run format` to fix formatting issues

## Build Troubleshooting

### Common Issues

1. **Test Failures**
   ```bash
   # Check specific failing tests
   npm test 2>&1 | grep -A5 -B5 "not ok"
   
   # Run tests with more verbose output
   node --test tests/**/*.test.js --reporter=spec
   ```

2. **Linting Errors**
   ```bash
   # Auto-fix most linting issues
   npm run lint:fix
   
   # Check specific linting errors
   npm run lint
   ```

3. **Formatting Issues**
   ```bash
   # Auto-format all files
   npm run format
   
   # Check which files need formatting
   npm run format:check
   ```

4. **Missing Dependencies**
   ```bash
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

### Build Script Locations

- `scripts/build.js` - Main build orchestrator
- `scripts/build-minified.js` - Minified bundle creation
- `scripts/test.js` - Custom test runner
- `scripts/version-banner.js` - Build status banners
- `scripts/completion-banner.js` - Build completion banners

## Release Process

### Pre-Release Validation

```bash
# Comprehensive validation (recommended before any release)
npm run make-release-dry-run
```

This command runs:
1. Linting
2. Format checking  
3. Complete test suite
4. Full build process
5. Success confirmation

### Manual Validation Steps

1. **Code Quality**
   ```bash
   npm run lint
   npm run format:check
   ```

2. **Test Coverage**
   ```bash
   npm test
   # Verify: 171 tests passing, 0 failures
   ```

3. **Build Artifacts**
   ```bash
   npm run build:all
   # Verify: dist/taskwerk.min.js created and executable
   ```

4. **Functional Testing**
   ```bash
   # Test the main CLI
   node bin/taskwerk.js --help
   
   # Test the minified bundle
   node dist/taskwerk.min.js --help
   ./dist/taskwerk.min.js --version
   ```

## Platform-Specific Notes

### macOS/Linux
- All commands work as documented
- Executable permissions handled automatically
- Git integration fully functional

### Windows
- Use `npm run` commands (avoid direct script execution)
- Git integration requires Git for Windows
- PowerShell or Command Prompt supported

## Continuous Integration

For CI/CD pipelines, use:

```bash
# Complete validation pipeline
npm ci                    # Clean install
npm run make-release-dry-run  # Full validation
```

This ensures:
- Clean dependency installation
- All quality checks pass
- Build artifacts are created successfully
- No regressions in functionality

## Dependencies

### Production Dependencies
- `commander`: CLI framework for parsing commands and options

### Development Dependencies
- `esbuild`: Fast JavaScript bundler and minifier
- `eslint`: JavaScript linting
- `prettier`: Code formatting

### Built-in Dependencies
- Node.js test runner (no external test framework required)
- Native Node.js modules for file system, process management, etc.

## File Artifacts

After a successful build:

```
dist/
└── taskwerk.min.js    # ~107KB minified executable bundle

# The minified bundle:
# - Contains all TaskWerk functionality
# - Can run standalone without npm installation  
# - Platform-agnostic (works wherever Node.js runs)
# - Includes proper shebang for direct execution
```

## Environment Requirements

- **Node.js**: 18.0.0+ (engines requirement in package.json)
- **Memory**: ~50MB for build process
- **Disk**: ~200MB for full development setup (including node_modules)
- **Network**: Required for npm install, optional for LLM features

## Support

For build issues:
1. Check this documentation
2. Verify Node.js version: `node --version`
3. Clean install: `rm -rf node_modules && npm install`
4. Run diagnostics: `npm run make-release-dry-run`

---

*This documentation is maintained alongside TaskWerk development. Last updated: v0.1.6*