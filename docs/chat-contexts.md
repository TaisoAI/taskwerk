# Chat Contexts & Conversation Management

Taskwerk's chat context system provides persistent conversation history for AI interactions, enabling continuous discussions about your tasks and projects.

## Overview

Chat contexts allow you to:
- Maintain separate conversations for different projects
- Create topic-specific conversations (e.g., "work", "learning", "planning")
- Continue discussions across sessions
- Review conversation history
- Manage multiple parallel conversations

## How It Works

### Conversation Types

1. **Project Conversations**
   - Automatically created when using `ask` or `agent` in a project directory
   - Scoped to the specific project
   - Ideal for project-specific discussions

2. **Global Conversations**
   - Available from anywhere
   - Default "general" conversation for quick questions
   - Named conversations for topic organization

3. **Mode Separation**
   - `ask` mode conversations (read-only assistant)
   - `agent` mode conversations (can modify files/tasks)
   - Each mode maintains separate conversation history

### Context Continuation

- Conversations automatically continue if accessed within 1 hour
- After 1 hour, a new conversation starts (unless using `--context`)
- Use `--new` to explicitly start a fresh conversation

## Visual Indicators

Taskwerk displays clear context information:

```
────────────────────────────────────────────────────────────
📁 💬 Active conversation: myproject project
   Continuing with 5 messages of history
   Use --new to start fresh, or twrk context to manage
────────────────────────────────────────────────────────────
```

Icons and their meanings:
- 📁 = Project scope | 🌍 = Global scope
- 💬 = Ask mode | 🤖 = Agent mode
- 🟢 = Recently active | ⚪ = Inactive

## Using Conversations

### Basic Usage

```bash
# Ask a question (continues recent conversation)
twrk ask "What were we discussing about authentication?"

# Start a new conversation
twrk ask --new "Let's talk about database design"

# Use a named conversation
twrk ask --context work "Remember this sprint planning idea"
```

### Managing Conversations

```bash
# List all conversations
twrk context list

# View conversation history
twrk context show               # Current conversation
twrk context show work          # By name
twrk context show CHAT-001      # By ID

# Organize conversations
twrk context rename CHAT-001 "auth-planning"
twrk context delete old-chat
```

## Best Practices

### 1. Use Named Conversations for Topics

```bash
# Create topic-specific conversations
twrk ask --context planning "Let's plan the Q1 roadmap"
twrk ask --context bugs "Help me debug this issue"
twrk ask --context learning "Explain dependency injection"
```

### 2. Project vs Global Contexts

- **Use project contexts** for project-specific discussions
- **Use global contexts** for cross-project topics or general questions

### 3. When to Start Fresh

Start a new conversation when:
- Switching to a completely different topic
- The current conversation has become too long
- You want a clean slate for a new problem

```bash
twrk ask --new "Different topic entirely"
```

### 4. Review Before Continuing

Check what was discussed before continuing:

```bash
# See recent messages
twrk context show --limit 5

# Then continue
twrk ask "Based on what we discussed, what's next?"
```

## Examples

### Sprint Planning Workflow

```bash
# Start a planning session
twrk ask --context sprint-42 "Let's plan sprint 42"

# Continue throughout the week
twrk ask --context sprint-42 "What tasks did we identify?"
twrk agent --context sprint-42 "Create the tasks we discussed"

# Review at end of sprint
twrk context show sprint-42
```

### Learning and Reference

```bash
# Build a knowledge base
twrk ask --context python-tips "How do I use decorators?"
twrk ask --context python-tips "Explain metaclasses"

# Later reference
twrk context show python-tips | grep decorator
```

### Debugging Sessions

```bash
# Start debugging
twrk ask --new "Help debug authentication error"

# Continue with findings
twrk ask "I found the error in auth.js line 42"

# Document solution
twrk agent "Add a comment explaining the fix we discussed"
```

## Database Storage

Conversations are stored in SQLite with:
- Full message history
- Timestamps for each interaction
- Metadata (tool calls, created tasks)
- No automatic expiration

Location:
- Project: `.taskwerk/tasks.db`
- Global: `~/.taskwerk/tasks.db`

## Tips & Tricks

1. **Quick Context Check**: Use `twrk context list` to see active conversations

2. **Context Switching**: The `switch` command shows you how to use a conversation:
   ```bash
   twrk context switch work
   # Output: To use this conversation, run:
   #   twrk ask --context work "your message"
   ```

3. **Quiet Mode**: Hide context display with `--quiet`:
   ```bash
   twrk ask --quiet "Quick question"
   ```

4. **Export Conversations**: Use `show` with redirection:
   ```bash
   twrk context show sprint-planning > sprint-notes.md
   ```

5. **Search History**: Combine with grep:
   ```bash
   twrk context show | grep -i "api design"
   ```

## Troubleshooting

### "No recent context found"
- This is normal after 1 hour of inactivity
- Use `--context <name>` to continue a specific conversation
- Or let it create a new conversation

### "Context not found"
- Check available contexts with `twrk context list --all`
- Context might be in a different scope (project vs global)

### Conversation Mix-up
- `ask` and `agent` maintain separate conversations
- Project and global contexts are separate
- Use `twrk context show` to verify which conversation you're in