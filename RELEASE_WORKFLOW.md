# Taskwerk Release Workflow

## Problem
When working directly on main branch:
- Local tests pass, CI tests fail
- GitHub release gets created (e.g., v0.7.3)
- npm publish fails due to CI failure
- Results in version mismatch between GitHub and npm

## Solution: Feature Branch Workflow

### 1. Development Phase
```bash
# Create feature branch from main
git checkout -b feature/v0.7.x-improvements

# Do all development work here
# Run tests locally
npm test

# Push to feature branch
git push origin feature/v0.7.x-improvements
```

### 2. CI Verification Phase
- Push to feature branch triggers CI
- Fix any CI-specific failures
- Iterate until CI passes on feature branch

### 3. Pre-Release Checklist
```bash
# On feature branch, ensure everything passes
npm run lint
npm run build
npm test

# Create PR to main
gh pr create --base main
```

### 4. Release Phase (after PR merged)
```bash
# Switch to main
git checkout main
git pull

# Run make-release script
npm run make-release

# This will:
# - Bump version
# - Run build and tests
# - Create git tag
# - Push to GitHub
# - Create GitHub release
# - CI will auto-publish to npm
```

## Branch Protection Rules (Recommended)

Add these GitHub branch protection rules for `main`:
1. Require pull request reviews
2. Require status checks to pass (CI)
3. Require branches to be up to date
4. Include administrators in restrictions

## Quick Rollback Strategy

If a release fails after GitHub release is created:
```bash
# Delete the problematic tag
git tag -d v0.7.3
git push origin :refs/tags/v0.7.3

# Delete GitHub release via CLI
gh release delete v0.7.3 --yes

# Fix issues on feature branch
# Re-attempt release process
```

## CI-Specific Test Debugging

Common CI vs Local differences:
1. **Timeouts**: CI may be slower
2. **File paths**: Case sensitivity on Linux (CI) vs macOS (local)
3. **Environment variables**: Different between environments
4. **Timezone differences**: Can affect date-based tests
5. **Memory/CPU constraints**: CI runners have limits

### Debug CI Failures
```bash
# Run tests exactly as CI does
CI=true npm run test:coverage

# Check Node version matches CI
node --version

# Test in Docker to simulate Linux environment
docker run -it --rm -v $(pwd):/app -w /app node:20 npm test
```