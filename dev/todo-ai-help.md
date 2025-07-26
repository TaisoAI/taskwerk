# AI Help System TODO List

## Hierarchical Command Knowledge System

### Phase 1: Rich Metadata Infrastructure
- [ ] Add `aiMetadata` field to Command class with three levels:
  - [ ] Level 1: Brief summary (always loaded) - name, category, tags
  - [ ] Level 2: Detailed metadata (intent-based loading) - purpose, capabilities, limitations
  - [ ] Level 3: Full examples & recipes (on-demand loading)
- [ ] Create metadata schema validation system
- [ ] Build metadata collection during build process

### Phase 2: Intent Recognition System
- [ ] Implement intent extraction from user queries
- [ ] Create intent patterns for common operations:
  - [ ] query_tasks - searching/listing tasks
  - [ ] modify_tasks - creating/updating tasks
  - [ ] code_generation - writing files/code
  - [ ] system_info - asking about taskwerk itself
- [ ] Map intents to relevant commands

### Phase 3: Context Management
- [ ] Implement AIContextManager class
- [ ] Support dynamic context building based on token budget
- [ ] Progressive enhancement strategy:
  - [ ] Start with minimal context
  - [ ] Load detailed metadata on intent match
  - [ ] Add examples only when needed
- [ ] Token budget management for different model sizes

### Phase 4: Plugin Support
- [ ] Define plugin metadata interface
- [ ] Build system to collect metadata from plugins
- [ ] Update knowledge base when plugins are added/removed
- [ ] Version-aware metadata system

### Phase 5: Testing & Validation
- [ ] Create metadata quality tests
- [ ] Test AI awareness of all commands
- [ ] Verify intent recognition accuracy
- [ ] Ensure context stays within token limits

### Phase 6: Implementation
- [ ] Update all existing commands with Level 1 metadata
- [ ] Add Level 2 metadata for core commands (ask, agent, llm, context)
- [ ] Create build script to generate ai-knowledge-base.json
- [ ] Update system prompts to use dynamic command discovery

## Benefits
- Scalability: Handle hundreds of commands without context overflow
- Accuracy: Intent-based loading provides focused context
- Extensibility: Plugins can provide their own metadata
- Model flexibility: Works with both small and large context windows

## Notes
- Prioritize correctness over response speed
- Only models with larger context windows may work optimally
- Hierarchical loading ensures efficient token usage