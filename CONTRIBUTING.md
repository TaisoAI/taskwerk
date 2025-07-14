# Contributing to Taskwerk

We love your input! We want to make contributing to Taskwerk as easy and transparent as possible.

## Code Style

We use Prettier and ESLint to maintain consistent code style. Before committing:

```bash
# Check formatting and linting
npm run check

# Auto-fix issues
npm run check:fix
```

### Optional: Install Pre-commit Hook

To automatically format code before each commit:

```bash
ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit
```

This ensures your code is always properly formatted before it reaches CI.

## Development Process

1. Fork the repo and create your branch from `main`
2. Run `npm install` to set up dependencies
3. Make your changes
4. Run `npm test` to ensure tests pass
5. Run `npm run check:fix` to format and lint
6. Commit your changes
7. Push and create a Pull Request

## Pull Request Process

1. Ensure all tests pass (`npm test`)
2. Update documentation if needed
3. The PR will trigger CI checks for:
   - Linting
   - Code formatting
   - Tests on Node 18, 20, and 22
   - Build verification

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npx vitest run test/commands/task/list.test.js

# Run tests in watch mode
npm run test:watch
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.