#!/bin/bash

# Test script for chat context feature
TWRK="./dist/taskwerk.js"

echo "=== Testing Chat Context Feature ==="
echo

# Create a test directory
TEST_DIR="test-playground-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "1. Testing Global Context (outside project)"
echo "=========================================="

echo "Q1: Asking about taskwerk..."
../$TWRK ask "What is taskwerk?"
echo

echo "Q2: Testing context continuation..."
../$TWRK ask "What did I just ask you?"
echo

echo "Q3: Using named context 'work'..."
../$TWRK ask --context work "Let's plan a feature for user authentication"
echo

echo "Q4: Continuing in 'work' context..."
../$TWRK ask --context work "What feature were we planning?"
echo

echo "Q5: Starting fresh with --new..."
../$TWRK ask --new "Tell me about Python"
echo

echo "Q6: Testing --quiet flag..."
../$TWRK ask --quiet "What's 2+2?"
echo

echo
echo "2. Testing Project Context"
echo "=========================="

echo "Initializing project..."
../$TWRK init -n "Test Project" -d "Testing chat context"
echo

echo "Q7: Asking in project context..."
../$TWRK ask "What project am I in?"
echo

echo "Q8: Testing project context continuation..."
../$TWRK ask "Create a plan for a todo app"
echo

echo "Q9: Continuing conversation..."
../$TWRK ask "What were the main features we discussed?"
echo

echo
echo "3. Testing Agent Command"
echo "======================="

echo "Q10: Agent creating task..."
../$TWRK agent --yolo "Create a task called 'Test chat context feature'"
echo

echo "Q11: Agent continuation..."
../$TWRK agent --yolo "What task did you just create?"
echo

echo
echo "4. Database Contents"
echo "==================="

echo "Chat contexts:"
sqlite3 ~/.taskwerk/taskwerk.db "SELECT id, name, project_id, type, turn_count FROM chat_contexts;" 2>/dev/null || echo "No global DB found"

if [ -f ".taskwerk/taskwerk.db" ]; then
    echo
    echo "Project contexts:"
    sqlite3 .taskwerk/taskwerk.db "SELECT id, name, project_id, type, turn_count FROM chat_contexts;"
fi

echo
echo "=== Test Complete ==="
echo "Test directory: $TEST_DIR"

# Return to original directory
cd ..