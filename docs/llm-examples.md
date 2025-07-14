# LLM Command Examples

The `llm` command provides direct access to your configured AI provider for general-purpose prompts.

## Basic Usage

### Simple prompt
```bash
taskwerk llm "What is the capital of France?"
```

### Multi-word prompt
```bash
taskwerk llm What is the meaning of life?
```

## Piping Support

### Pipe from echo
```bash
echo "Explain quantum computing" | taskwerk llm
```

### Pipe from file
```bash
cat prompt.txt | taskwerk llm
```

### Pipe output to file
```bash
taskwerk llm "Write a haiku about coding" > haiku.txt
```

### Chain with other commands
```bash
taskwerk list --format json | taskwerk llm "Summarize these tasks"
```

## File Input

### Read prompt from file
```bash
taskwerk llm --file long-prompt.txt
```

## Parameter Substitution

### Basic substitution
```bash
taskwerk llm "Explain {topic} in simple terms" --params topic="machine learning"
```

### Multiple parameters
```bash
taskwerk llm "Compare {lang1} and {lang2}" --params lang1=Python lang2=JavaScript
```

### Parameters with spaces
```bash
taskwerk llm "Review this {type}" --params type="pull request"
```

## System Prompts

### Add context
```bash
taskwerk llm "Review this code" --system "You are a senior software engineer"
```

### Expert mode
```bash
taskwerk llm "Analyze this algorithm" --system "You are a computer science professor"
```

## Provider and Model Override

### Use specific provider
```bash
taskwerk llm "Hello" --provider openai
```

### Use specific model
```bash
taskwerk llm "Complex question" --model gpt-4
```

### Both provider and model
```bash
taskwerk llm "Test" --provider anthropic --model claude-3-opus-20240229
```

## Temperature Control

### Creative responses (high temperature)
```bash
taskwerk llm "Write a story" --temperature 1.5
```

### Focused responses (low temperature)
```bash
taskwerk llm "Calculate the sum" --temperature 0.2
```

## Token Limits

### Limit response length
```bash
taskwerk llm "Explain everything about AI" --max-tokens 100
```

## Task Context

### Include current tasks
```bash
taskwerk llm "What should I work on next?" --context-tasks
```

### Analyze workload
```bash
taskwerk llm "Analyze my current workload" --context-tasks
```

## Output Modes

### Disable streaming (wait for complete response)
```bash
taskwerk llm "Long question" --no-stream
```

### Raw output (no formatting)
```bash
taskwerk llm "Generate JSON" --raw > data.json
```

### Quiet mode (no stats)
```bash
taskwerk llm "Quick question" --quiet
```

## Advanced Examples

### Code review from git diff
```bash
git diff | taskwerk llm "Review this code change" --system "Focus on security issues"
```

### Generate commit message
```bash
git diff --staged | taskwerk llm "Generate a commit message for these changes"
```

### Task analysis
```bash
taskwerk export --format json | taskwerk llm "Identify bottlenecks in this project"
```

### Documentation generation
```bash
cat src/api.js | taskwerk llm "Generate API documentation in markdown"
```

### Test case generation
```bash
cat src/function.js | taskwerk llm "Generate unit tests for this function"
```

### Translation
```bash
taskwerk llm "Translate to Spanish: {text}" --params text="Hello, how are you?"
```

### Template processing
```bash
cat email-template.txt | taskwerk llm --params name="John" subject="Project Update"
```

## Combining with Other Taskwerk Commands

### Summarize completed tasks
```bash
taskwerk list --status done --format json | taskwerk llm "Write a progress report"
```

### Generate task descriptions
```bash
taskwerk llm "Create 5 subtasks for: implement user authentication" --raw | taskwerk import -
```

### Analyze task dependencies
```bash
taskwerk export --format json --with-metadata | taskwerk llm "Identify critical path"
```

## Error Handling

### Check if LLM is configured
```bash
taskwerk aiconfig --show
```

### Test connection before use
```bash
taskwerk aiconfig --test
```

### Configure if needed
```bash
taskwerk aiconfig --choose
```

## Best Practices

1. **Use system prompts** for consistent behavior
2. **Adjust temperature** based on task type
3. **Set token limits** for cost control
4. **Use raw mode** for structured output
5. **Pipe from files** for long prompts
6. **Use parameters** for reusable prompts
7. **Include context** when relevant
8. **Test providers** before important tasks