#!/bin/bash

# V3 Documentation Consolidation Script
# This script reorganizes v3 documentation as planned

echo "📚 Starting v3 documentation consolidation..."

# Create v3-planning archive directory
echo "📁 Creating archive directory..."
mkdir -p dev/archive/v3-planning

# Move refocus documents
echo "📦 Archiving refocus documents..."
[ -f "dev/v3-refocus-proposal.md" ] && mv dev/v3-refocus-proposal.md dev/archive/v3-planning/
[ -f "dev/v3-refocus-internals.md" ] && mv dev/v3-refocus-internals.md dev/archive/v3-planning/
[ -f "dev/v3-refocus-mcp.md" ] && mv dev/v3-refocus-mcp.md dev/archive/v3-planning/

# Move harmonization documents
echo "📦 Archiving harmonization documents..."
[ -f "dev/v3-canonical-reference.md" ] && mv dev/v3-canonical-reference.md dev/archive/v3-planning/
[ -f "dev/v3-harmonization-summary.md" ] && mv dev/v3-harmonization-summary.md dev/archive/v3-planning/
[ -f "dev/v3-quick-reference.md" ] && mv dev/v3-quick-reference.md dev/archive/v3-planning/

# Move legacy documents
echo "📦 Archiving legacy documents..."
[ -f "dev/v3-architecture.md" ] && mv dev/v3-architecture.md dev/archive/v3-planning/
[ -f "dev/v3-ai-future.md" ] && mv dev/v3-ai-future.md dev/archive/v3-planning/

# Move the consolidation plan itself
echo "📦 Archiving consolidation plan..."
[ -f "dev/v3-document-consolidation-plan.md" ] && mv dev/v3-document-consolidation-plan.md dev/archive/v3-planning/

# List remaining v3 documents
echo ""
echo "✅ Consolidation complete!"
echo ""
echo "📚 Primary v3 documents (keeping):"
ls -la dev/v3-*.md 2>/dev/null || echo "  (none found)"
echo ""
echo "📦 Archived documents:"
ls -la dev/archive/v3-planning/ 2>/dev/null || echo "  (none found)"
echo ""
echo "Next steps:"
echo "1. Update package.json version to 0.3.10"
echo "2. Update README.md to reference new docs"
echo "3. Commit changes"