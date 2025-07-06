# V3 Document Consolidation Plan

## Overview

We've consolidated the sprawling v3 documentation into three focused documents. Here's the plan for handling all existing docs.

## New Primary Documents (Keep)

1. **v3-taskwerk-prd.md** ✅
   - Product vision and requirements
   - User guide and examples
   - AI integration overview
   - FAQ and use cases

2. **v3-cli-reference.md** ✅
   - Complete command reference
   - Options and examples
   - Tips and workflows

3. **v3-implementation-guide.md** ✅
   - Technical architecture
   - Database schema
   - API design
   - Development guide

## Documents to Archive

Move these to `dev/archive/v3-planning/`:

### Refocus Documents (Historical Value)
- `v3-refocus-proposal.md` - Original refocus design
- `v3-refocus-internals.md` - Detailed technical specs
- `v3-refocus-mcp.md` - MCP integration plans

### Harmonization Documents (Process Records)
- `v3-canonical-reference.md` - Conflict resolution
- `v3-harmonization-summary.md` - Process documentation
- `v3-quick-reference.md` - Superseded by CLI reference

### Legacy Documents
- `v3-architecture.md` - Contains good ideas but conflicts
- `v3-ai-future.md` - Future vision beyond current scope
- `v3-cli-organization-refactor.md` - Planning document

### Other Planning Docs
- Any other v3-*.md files not listed above

## Documents to Update

1. **README.md** (project root)
   - Point to new v3 documentation
   - Update version to 0.3.10
   - Clear getting started guide

2. **CHANGELOG.md**
   - Document the consolidation
   - List new documentation structure

## Action Plan

```bash
# 1. Create archive directory
mkdir -p dev/archive/v3-planning

# 2. Move documents to archive
mv dev/v3-refocus-*.md dev/archive/v3-planning/
mv dev/v3-canonical-reference.md dev/archive/v3-planning/
mv dev/v3-harmonization-summary.md dev/archive/v3-planning/
mv dev/v3-quick-reference.md dev/archive/v3-planning/
mv dev/v3-architecture.md dev/archive/v3-planning/
mv dev/v3-ai-future.md dev/archive/v3-planning/

# 3. Keep only the three primary docs
# dev/v3-taskwerk-prd.md
# dev/v3-cli-reference.md  
# dev/v3-implementation-guide.md

# 4. Update package.json version
# Change version to 0.3.10

# 5. Update README.md to reference new docs

# 6. Commit with clear message
git add .
git commit -m "docs: consolidate v3 documentation into three focused guides

- Product Requirements & Vision (PRD)
- CLI Reference Guide
- Implementation Guide

Archived planning and harmonization documents for historical reference."
```

## Benefits of Consolidation

1. **Clarity**: Developers know exactly where to look
2. **Maintainability**: Three documents instead of 10+
3. **Discoverability**: Clear purpose for each document
4. **No Conflicts**: Single source of truth for each topic
5. **Version Clarity**: 0.3.x matches v3 architecture

## Reading Order for New Developers

1. Start with **v3-taskwerk-prd.md** for vision and overview
2. Try examples from **v3-cli-reference.md**
3. Dive into **v3-implementation-guide.md** for development

## Long Term

As we implement v3:
- PRD becomes the basis for user documentation
- CLI reference becomes `twrk --help` content
- Implementation guide becomes developer docs

This positions us well for the 1.0 release!