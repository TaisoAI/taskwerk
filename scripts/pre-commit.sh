#!/bin/bash
# Git pre-commit hook to format and lint code
# 
# To install:
#   ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit

# Format and lint all staged JavaScript files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|jsx)$')

if [ -n "$STAGED_FILES" ]; then
  echo "🎨 Formatting staged files..."
  
  # Format with prettier
  npx prettier --write $STAGED_FILES
  
  # Lint with eslint
  npx eslint --fix $STAGED_FILES
  
  # Re-add the formatted files
  git add $STAGED_FILES
  
  echo "✅ Files formatted and linted"
fi

exit 0