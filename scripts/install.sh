#!/bin/bash
# Install zo-memory-system skill into workspace
# Usage: ./install.sh

set -e

echo "════════════════════════════════════════════════════════════"
echo "  Zo Memory System - Installation"
echo "════════════════════════════════════════════════════════════"
echo

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_DIR="/home/workspace"
MEMORY_DIR="$WORKSPACE_DIR/.zo/memory"

echo "📁 Setting up directories..."
mkdir -p "$MEMORY_DIR"/{personas,checkpoints,scripts}

echo "📋 Installing scripts..."
cp "$SKILL_DIR/scripts/memory.ts" "$MEMORY_DIR/scripts/"
cp "$SKILL_DIR/scripts/schema.sql" "$MEMORY_DIR/scripts/"
cp "$SKILL_DIR/scripts/add-persona.sh" "$MEMORY_DIR/scripts/"
cp "$SKILL_DIR/scripts/demo.ts" "$MEMORY_DIR/scripts/"
chmod +x "$MEMORY_DIR/scripts/add-persona.sh"

echo "📚 Installing examples..."
for file in "$SKILL_DIR/assets/examples"/*.md; do
  if [ -f "$file" ]; then
    cp "$file" "$MEMORY_DIR/personas/"
    echo "  ✓ $(basename "$file")"
  fi
done

echo "⚙️  Initializing database..."
cd "$WORKSPACE_DIR"
if [ ! -f "$MEMORY_DIR/shared-facts.db" ]; then
  bun "$MEMORY_DIR/scripts/memory.ts" init 2>/dev/null || echo "  Database will be created on first use"
fi

echo "📝 Creating workspace AGENTS.md..."
if [ ! -f "$WORKSPACE_DIR/AGENTS.md" ]; then
  cat > "$WORKSPACE_DIR/AGENTS.md" << 'EOF'
# Zo Computer Workspace Memory

## Memory System Reference

This workspace uses a **SQLite-based memory system** for persona continuity.

### Quick Commands

```bash
# Store a fact
bun .zo/memory/scripts/memory.ts store \
  --entity "user" --key "preference" --value "value" --decay permanent

# Search memory
bun .zo/memory/scripts/memory.ts search "query"

# Lookup by entity
bun .zo/memory/scripts/memory.ts lookup --entity "user"

# View stats
bun .zo/memory/scripts/memory.ts stats
```

### Decay Tiers

| Tier | TTL | Use Case |
|------|-----|----------|
| `permanent` | Never | Core user facts, preferences |
| `stable` | 90 days | Preferences, recurring decisions |
| `active` | 14 days | Current projects, tasks |
| `session` | 24 hours | Temporary context |
| `checkpoint` | 4 hours | Task state snapshots |

### Persona Memory Files

Critical facts for each persona are stored in:
- `file '.zo/memory/personas/[persona-name].md'`

These are lean (20-30 facts) and always loaded with the persona.

### Shared Memory Database

All other facts go into SQLite at `file '.zo/memory/shared-facts.db'`:
- Cross-persona facts use `--persona shared`
- Persona-specific facts use `--persona [name]`
EOF
  echo "  ✓ Created AGENTS.md"
fi

echo
echo "════════════════════════════════════════════════════════════"
echo "  ✅ Installation Complete"
echo "════════════════════════════════════════════════════════════"
echo
echo "Quick start:"
echo "  bun .zo/memory/scripts/memory.ts stats"
echo "  bun .zo/memory/scripts/add-persona.sh \"my-persona\" \"Role\""
echo
echo "Documentation:"
echo "  file 'Skills/zo-memory-system/SKILL.md'"
echo
