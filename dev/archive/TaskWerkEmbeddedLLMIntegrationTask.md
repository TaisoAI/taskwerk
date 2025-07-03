# taskwerk Embedded LLM Integration Task

## 🎯 **Project Overview**

Integrate a tiny local LLM into taskwerk to provide natural language interface for task management, making the CLI more accessible and intelligent while maintaining privacy and zero API costs.

## 🚀 **Core Concept**

Create an optional AI assistant that understands natural language requests and converts them to taskwerk CLI commands via **built-in tool calling**. The LLM has direct access to taskwerk's command system, enabling seamless human-AI collaboration.


### **Key Idea: LLM with taskwerk Tool Integration**
```javascript
// The LLM has taskwerk CLI as a built-in tool
const tools = [
  {
    name: "taskwerk_add",
    description: "Add a new task",
    parameters: { title: string, priority: enum, category: string }
  },
  {
    name: "taskwerk_list", 
    description: "List tasks with filters",
    parameters: { priority: enum, status: enum, category: string }
  },
  {
    name: "taskwerk_complete",
    description: "Mark task as completed",
    parameters: { id: string, note: string }
  }
  // ... all taskwerk commands as tools
];
```

## 📋 **Technical Requirements**

### **Phase 1: Foundation**  
Add and maintain local or remote models:


#### **1.1 Core LLM Infrastructure**
- [ ] **Model Selection & Testing**
  - Evaluate SmolLM2 (1.7B) vs Phi-4 (3.8B) for command understanding
  - Test ONNX Runtime integration for cross-platform deployment (TBD, or use huggingface transormers)
  - Benchmark inference speed and memory usage
  - Create quantized versions for different hardware tiers
  - Support use of OpenAIApi compatible key if user choose
    - taskwerk llm --addkey  ..key..  // use proper sub command

#### **1.2 LLM Manager Module**
```javascript
// src/llm/llm-manager.js
class LLMManager {
  async installModel(modelName, progressCallback)
  async loadModel(modelName) 
  async processNaturalLanguage(input, context)
  async getModelInfo()
  isModelAvailable(modelName)
  uninstallModel(modelName)
}
```

#### **1.3 Tool Integration System**
- [ ] **taskwerk Tool Registry**
  - Define all taskwerk commands as LLM tools
  - Create tool schemas with parameter validation
  - Implement tool execution bridge
  - Add result formatting for LLM responses

#### **1.4 CLI Command Extensions**
```bash
# Installation commands


##use subcommand?
taskwerk llmconfig --install-llm [model]     # Download and setup LLM
taskwerk llmconfig --list-models             # Show available models
taskwerk llmconfig --model-info [model]      # Show model details
taskwerk llmconfig --uninstall-llm [model]   # Remove model

# Natural language interface
taskwerk ask "create a task for fixing auth"
taskwerk chat                      # Interactive mode
taskwerk "show me high priority tasks"  # Direct natural language

taskwerk ask ...question to ask but no action will be taken...
taskwerk agent ... same but actions will be taken
taskwerk llm  ... just make a raw llm call but not a taskwerk command, allows specifiable llm params at commandline

```

### **Phase 2: Natural Language Processing (Week 3)**

#### **2.1 Prompt Engineering**
- [ ] **System Prompt Design**
```
You are taskwerk Assistant, an AI helper for task management.
You have access to taskwerk commands via function calls.
Convert user requests to appropriate taskwerk actions.

Available tools: taskwerk_add, taskwerk_list, taskwerk_start, taskwerk_complete, taskwerk_status

Always:
- Use function calls to execute taskwerk commands
- Provide helpful summaries of actions taken
- Ask for clarification when requests are ambiguous
- Maintain context about current tasks and session
```

#### **2.2 Context Management**
- [ ] **Session Context**
  - Track current task state in conversation
  - Remember recent actions and outcomes
  - Maintain conversation history for follow-ups
  - Integration with `.task-session.js