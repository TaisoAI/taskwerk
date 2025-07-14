# Taskwerk Release Checklist

## Automated Release Process

Run the release script:
```bash
npm run make-release
```

This will:
1. ✅ Check you're on main branch
2. ✅ Check for uncommitted changes
3. ✅ Run tests
4. ✅ Build the project
5. ✅ Bump version (patch/minor/major)
6. ✅ Generate release notes from commits
7. ✅ Create git tag
8. ✅ Push to GitHub
9. ✅ Create GitHub release

## Manual Release Process

If you prefer to release manually:

### 1. Pre-release Checks
- [ ] Ensure on main branch: `git branch`
- [ ] Pull latest changes: `git pull origin main`
- [ ] No uncommitted changes: `git status`
- [ ] All tests pass: `npm test`
- [ ] Linting passes: `npm run lint`

### 2. Version Bump
- [ ] Update version in package.json
- [ ] Run build: `npm run build`

### 3. Git Operations
```bash
git add package.json
git commit -m "chore: bump version to X.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

### 4. GitHub Release
Using GitHub CLI:
```bash
gh release create vX.Y.Z \
  --title "TaskWerk X.Y.Z" \
  --notes "## What's Changed\n\n- Feature 1\n- Feature 2\n\n## Installation\n\`\`\`bash\nnpm install -g taskwerk@X.Y.Z\n\`\`\`" \
  dist/taskwerk.js
```

Or manually on GitHub:
1. Go to https://github.com/TaisoAI/taskwerk/releases/new
2. Choose tag vX.Y.Z
3. Title: TaskWerk X.Y.Z
4. Add release notes
5. Attach dist/taskwerk.js
6. Publish release

### 5. NPM Publish
The GitHub Actions workflow will automatically publish to npm when a release is created.

To publish manually:
```bash
npm publish
```

## Post-release
- [ ] Verify npm package: https://www.npmjs.com/package/taskwerk
- [ ] Test installation: `npm install -g taskwerk@X.Y.Z`
- [ ] Update any documentation if needed
- [ ] Announce release (if applicable)