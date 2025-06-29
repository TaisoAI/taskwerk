# Tests

This directory contains the test suite for taskwerk.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
node --test tests/utils/id-generator.test.js
```

## Test Structure

- `tests/core/` - Tests for core task management functionality
- `tests/utils/` - Tests for utility functions
- `tests/git/` - Tests for git integration (future)
- `tests/commands/` - Tests for CLI commands (future)

## Writing Tests

We use Node.js built-in test runner. Example:

```javascript
import { test } from 'node:test';
import assert from 'node:assert';

test('description of test', () => {
  // Test implementation
  assert.strictEqual(actual, expected);
});
```

## Test Coverage

Run tests to ensure all functionality works as expected before publishing.