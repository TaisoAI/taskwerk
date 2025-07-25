# Chat Management Phase 2: Interactive Mode

**Prerequisites**: Phase 1 chat management must be fully implemented and tested.

## Overview

Phase 2 adds an interactive chat mode (`twrk chat`) for extended conversations, providing a REPL-like experience with slash commands that mirror the full CLI functionality.

## Interactive Chat Mode

```bash
$ twrk chat
╭─ [Project: webapp] Interactive Mode ─╮
│ Type /help for commands, /exit to quit │
╰────────────────────────────────────────╯

> how should I implement authentication?
I recommend using JWT tokens for your webapp...

> /mode agent
Switched to agent mode.

> implement the basic auth model
Creating src/models/User.js...

> /task list
Showing your tasks:
- TASK-045: Implement authentication (just created)
- TASK-023: Fix login bug (in-progress)

> /model
Current model: claude-3-opus

> /exit
Goodbye! Chat saved to context: webapp/auth-discussion
```

## Slash Commands Design

### Chat Management Commands
- `/mode [ask|agent]` - Switch between ask and agent modes
- `/context list` - List available contexts
- `/context new <name>` - Create new context
- `/context switch <name>` - Switch to different context
- `/model` - Show current AI model
- `/models` - List all available models
- `/config` - Show current configuration
- `/config set <key> <value>` - Update configuration

### Task Management Commands (Project Context Only)
- `/task add <description>` - Create new task
- `/task list [filter]` - List tasks
- `/task show <id>` - Show task details
- `/task update <id> [options]` - Update task
- `/task done <id>` - Mark task as done
- `/tasks` - Alias for `/task list`
- `/status` - Show project status

### General Commands
- `/help [command]` - Show help for all or specific command
- `/exit`, `/bye`, `/quit` - Exit interactive mode
- `/clear` - Clear screen
- `/history [n]` - Show last n messages
- `/export [filename]` - Export conversation
- `/save` - Force save current conversation
- `/undo` - Undo last action (agent mode only)

## Implementation Considerations

### Command Parser
```javascript
class SlashCommandParser {
  constructor() {
    this.commands = new Map();
    this.registerCommands();
  }
  
  parse(input) {
    if (!input.startsWith('/')) return null;
    
    const [cmd, ...args] = input.slice(1).split(/\s+/);
    const command = this.commands.get(cmd);
    
    if (!command) {
      return { error: `Unknown command: /${cmd}` };
    }
    
    return command.parse(args);
  }
}
```

### Features to Implement

1. **Command System**
   - Command registration and discovery
   - Argument parsing and validation
   - Tab completion for commands and arguments
   - Command history with up/down arrows

2. **UI Enhancements**
   - Syntax highlighting for code blocks
   - Markdown rendering for responses
   - Progress indicators for long operations
   - Multi-line input support (``` for code blocks)

3. **State Management**
   - Maintain mode state between messages
   - Handle context switching mid-conversation
   - Graceful error recovery
   - Undo/redo capability for agent actions

4. **Integration**
   - All CLI commands available as slash commands
   - Consistent behavior between CLI and chat modes
   - Proper permission handling
   - Tool availability based on context

## Design Topics Requiring Separate Documentation

1. **Slash Command Specification**
   - Full command grammar
   - Argument types and validation
   - Help text format
   - Error message standards

2. **Tab Completion System**
   - Command completion
   - Argument completion
   - File path completion
   - Context-aware suggestions

3. **Rich Terminal UI**
   - Layout management
   - Color schemes
   - Progress indicators
   - Status bars

## Success Criteria

- All CLI functionality accessible via slash commands
- Seamless mode switching without losing context
- Tab completion for all commands
- Rich help system within chat
- No breaking changes to Phase 1 functionality

## Timeline Estimate

- Command parser: 1 week
- Slash command implementation: 2 weeks
- UI enhancements: 1 week
- Testing and refinement: 1 week
- Total: ~5 weeks after Phase 1 completion