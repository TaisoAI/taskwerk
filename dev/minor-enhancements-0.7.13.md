# Minor Enhancements for v0.7.13

## 1. Search Command Improvements

### Add Search Alias
Create a standalone `search` command that aliases to `list --search`:

```javascript
// src/commands/search.js
export function searchCommand() {
  const search = new Command('search');
  
  search
    .description('Search tasks by name, description, or content')
    .argument('<term>', 'Search term')
    .option('-s, --status <status>', 'Filter by status')
    .option('-a, --assignee <name>', 'Filter by assignee')
    .option('-p, --priority <level>', 'Filter by priority')
    .option('-t, --tags <tags...>', 'Filter by tags')
    .option('--format <format>', 'Output format', 'table')
    .action(async (term, options) => {
      // Delegate to list command with search option
      const listOptions = { ...options, search: term };
      await listCommand.action(listOptions);
    });
    
  return search;
}
```

### Update Main Help
Add to `src/cli/index.js` help text:

```
Common Workflows:
  Search & Filter:
    $ twrk search "authentication"              # Find tasks mentioning auth
    $ twrk list --search "bug" -p high         # Find high priority bugs
    $ twrk list --search "TODO" -s in-progress # Find in-progress TODOs
    
  Task Splitting:
    $ twrk split 1 -n "Backend" "Frontend"     # Quick split into 2 tasks
    $ twrk split 1 --divide-estimate           # Interactive with estimates
    $ twrk split 1 -i                          # Full interactive mode
```

## 2. Intent Loop for Ask Command

### Concept
Transform single-shot Q&A into multi-step planning and execution:

```bash
$ twrk ask "I need to implement user authentication"

🤔 Understanding your request...

I'll help you implement user authentication. Let me break this down:

📋 **Task Analysis:**
1. Set up authentication backend
2. Create user model and database schema  
3. Implement login/logout endpoints
4. Add JWT token handling
5. Create frontend login form
6. Add protected routes
7. Write tests

Would you like me to:
[1] Create these as tasks in Taskwerk
[2] Show implementation details for each
[3] Generate code examples
[4] Both 1 and 2

Your choice: _
```

### Implementation Approach

#### Phase 1: Enhanced Ask with Follow-ups
```javascript
// Add to ask.js
async function handleIntentLoop(initialQuestion, llmManager, toolExecutor, options) {
  // First, analyze the intent
  const analysis = await analyzeIntent(initialQuestion, llmManager);
  
  if (analysis.requiresMultipleSteps) {
    // Show the plan
    console.log('\n📋 I can help with this in several steps:\n');
    analysis.steps.forEach((step, i) => {
      console.log(`${i + 1}. ${step.description}`);
    });
    
    // Ask for confirmation
    const choice = await promptUser([
      'Create tasks for these steps',
      'Show details for each step',
      'Generate code/examples',
      'All of the above'
    ]);
    
    // Execute based on choice
    await executeIntentPlan(analysis, choice, toolExecutor);
  }
}
```

#### Phase 2: Batched Tool Execution
Instead of executing tools one by one, batch related operations:

```javascript
// Current approach (sequential)
const tasks = await list_tasks();
const file1 = await read_file('src/auth.js');
const file2 = await read_file('src/user.js');

// Batched approach (parallel where possible)
const [tasks, file1, file2] = await Promise.all([
  list_tasks(),
  read_file('src/auth.js'),
  read_file('src/user.js')
]);
```

### Intent Categories to Recognize

1. **Implementation Requests**
   - "I need to implement X"
   - "How do I build Y"
   - "Help me create Z"
   → Create task breakdown

2. **Debugging/Investigation**
   - "Why is X not working"
   - "Debug this error"
   - "What's wrong with Y"
   → Analyze code/logs, suggest fixes

3. **Planning/Architecture**
   - "Design a system for X"
   - "What's the best approach for Y"
   → Create design docs, task hierarchies

4. **Code Review/Refactoring**
   - "Review this code"
   - "How can I improve X"
   → Analyze and suggest improvements

## 3. Implementation Priority

### Quick Wins (30 mins each)
1. ✅ Add search examples to help
2. ✅ Add split examples to help  
3. ✅ Create search alias command

### Medium Effort (2-4 hours)
4. 🔄 Basic intent detection in ask
5. 🔄 Simple follow-up prompts

### Larger Effort (1-2 days)
6. 🚀 Full intent loop with state management
7. 🚀 Batched tool execution
8. 🚀 Persistent conversation context

## 4. Ask Command Evolution Path

### Current State
```bash
$ twrk ask "what tasks are assigned to me?"
# Single response listing tasks
```

### Next: Intent Recognition
```bash
$ twrk ask "I need to fix the login bug"
# Recognizes implementation intent
# Offers to create subtasks
```

### Future: Conversational Flow
```bash
$ twrk ask --interactive
> I need to implement user auth
< I'll help you break this down. First, what auth method?
> JWT with refresh tokens
< Great! Here's my suggested task breakdown...
> Looks good, create them
< ✅ Created 7 tasks. Would you like implementation details?
```

## 5. Technical Considerations

### Intent Detection
Use LLM to classify intent:
```javascript
const INTENT_PROMPT = `
Classify the user's intent into one of these categories:
- implementation: User wants to build/create something
- debugging: User needs help fixing an issue
- planning: User needs architecture/design help
- review: User wants code review/improvements
- query: Simple information request

User input: ${question}

Respond with: {category: "...", confidence: 0.0-1.0, subtasks: []}
`;
```

### State Management
For multi-turn conversations:
```javascript
class ConversationState {
  constructor() {
    this.turns = [];
    this.context = {};
    this.pendingActions = [];
  }
  
  addTurn(role, content) {
    this.turns.push({ role, content, timestamp: Date.now() });
  }
  
  getPendingActions() {
    return this.pendingActions.filter(a => !a.completed);
  }
}
```

## Next Steps

1. Start with the quick wins (help text updates)
2. Implement search alias  
3. Add basic intent detection to ask
4. Test with real-world scenarios
5. Iterate based on usage patterns