# V3 Document Harmonization Summary

**Date**: 2025-01-06
**Purpose**: Document the harmonization of v3 design documents

## Documents Reviewed

### Primary Documents (Authoritative)
1. **v3-refocus-proposal.md** - The main refocus design
2. **v3-refocus-internals.md** - Technical implementation details
3. **v3-refocus-mcp.md** - MCP integration specification

### Legacy Documents (Updated)
1. **v3-architecture.md** - Contains valuable insights but had conflicts
   - Added harmonization note pointing to canonical reference
   - Preserved architectural wisdom while noting terminology conflicts

### New Documents Created
1. **v3-canonical-reference.md** - Single source of truth for:
   - Task states (active, not in_progress)
   - Command structure (subcommands)
   - Database schema
   - Notes implementation
   - Architecture decisions

## Key Harmonization Decisions

### 1. Task States
- **Canonical**: `todo`, `active`, `paused`, `blocked`, `completed`, `archived`
- **Deprecated**: `in_progress` (use `active`), `error` (use `blocked` with reason)

### 2. Command Structure
- **Canonical**: Subcommand structure (`taskwerk task add`, `taskwerk data export`)
- **Deprecated**: Flat commands (`taskwerk add`, `taskwerk export`)
- **Shell Alias**: `twrk` for brevity

### 3. Notes Implementation
- **Canonical**: Dual approach
  - `task.notes` field for mutable working notes
  - `task_notes` table for immutable audit trail
- **Format**: Markdown with YAML frontmatter

### 4. Database Schema
- **Canonical**: As defined in v3-canonical-reference.md
- **Key Fields**: Added `notes`, `paused` state, proper constraints

### 5. AI Architecture
- **Three Modes**: ask (read-only), agent (actions), raw (pipeline)
- **Natural Language**: Auto-detection of mode
- **Separate Config**: ai-config.json

## Implementation Priority

1. **Core** (v3.0)
   - Task CRUD with new schema
   - Subcommand CLI
   - Import/Export

2. **AI** (v3.1)
   - Three modes
   - Natural language interface

3. **MCP** (v3.2)
   - No breaking changes
   - Progressive enhancement

## Action Items for Developers

1. **Use v3-canonical-reference.md** as the authoritative source
2. **Follow subcommand structure** in all new development
3. **Use `active` not `in_progress`** in code and docs
4. **Implement dual notes approach** as specified
5. **Reference this summary** when questions arise

## Benefits of Harmonization

1. **Clarity**: Single source of truth eliminates confusion
2. **Consistency**: All developers use same terminology
3. **Simplicity**: Fewer commands, clearer structure
4. **Future-Proof**: MCP-ready architecture

## Preserved Value

While harmonizing, we preserved:
- Fred's architectural insights from v3-architecture.md
- Andrei's implementation guidance
- All workflow examples
- Performance considerations
- Security considerations

The harmonization maintains the soul of v3 while clarifying implementation details.