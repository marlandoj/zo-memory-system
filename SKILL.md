---
name: zo-memory-system
description: SQLite-based persona memory system for Zo Computer. Gives personas persistent memory with 5-tier decay, full-text search, and swarm integration. No external dependencies.
compatibility: Created for Zo Computer. Requires Bun (built-in sqlite support).
metadata:
  author: marlandoj.zo.computer
  version: 1.1.0
  updated: 2026-02-18
---

# Zo Memory System Skill v1.1.0

Give your Zo personas persistent memory without external services.

**New in v1.1:** Integration with Swarm Orchestrator v4 for token-optimized hierarchical memory.

---

## What You Get

- **SQLite database** — Fast local storage with FTS5 full-text search
- **5-tier decay system** — Automatic pruning from session (24h) to permanent (never)
- **Per-persona memory files** — Critical facts always loaded with the persona
- **Shared memory database** — Cross-persona facts and context
- **Swarm integration** — Token-optimized memory for multi-agent workflows
- **Scheduled maintenance** — Hourly prune/decay automation
- **Checkpoint system** — Save/restore task state

---

## Quick Start

```bash
# Initialize the database
cd /home/workspace/Skills/zo-memory-system
bun scripts/memory.ts init

# Add memory to a persona
bun scripts/add-persona.sh "my-persona" "Role description"

# Store a fact
bun scripts/memory.ts store \
  --entity "user" \
  --key "preference" \
  --value "value" \
  --decay permanent
```

---

## Swarm Integration (v4)

The memory system integrates with `zo-swarm-orchestrator` v4 for token-optimized multi-agent memory management.

### How It Works

| Memory Type | Storage | Use Case |
|-------------|---------|----------|
| **Persona Memory** | Files (`.zo/memory/personas/*.md`) | Critical facts loaded with each persona |
| **Shared Memory** | SQLite (`.zo/memory/shared-facts.db`) | Cross-persona facts, decisions |
| **Swarm Memory** | SQLite (`~/.swarm/swarm-memory.db`) | Task outputs, session context |
| **Hierarchical** | Combined working + long-term | Token-bounded agent context |

### From Swarm to Persona Memory

Swarm tasks can promote stable conclusions into persona memory:

```json
{
  "id": "analysis",
  "persona": "frontend-developer",
  "task": "Analyze UI/UX patterns",
  "outputToMemory": true,
  "promoteToPersonaMemory": true,
  "promotionMetadata": {
    "entity": "decision",
    "category": "design-patterns",
    "decay": "stable"
  }
}
```

When executed via `orchestrate-v4.ts`, facts are automatically stored in shared memory using this system.

### Memory Flow

```
┌─────────────────────────────────────────────────────────┐
│                     Swarm Session                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Agent Output → Token Optimizer → Swarm Memory DB     │
│        ↓                                               │
│   Promotable? → Yes → Persona Memory (this skill)      │
│        ↓                                               │
│   Next Agent ← Hierarchical Context Retrieval          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Configure Swarm Memory Path

```bash
# Default location (auto-created)
export SWARM_MEMORY_PATH="$HOME/.swarm/swarm-memory.db"

# Or specify in orchestration command
bun orchestrate-v4.ts tasks.json --db-path /custom/path/swarm.db
```

---

## Commands

### Store Facts
```bash
bun scripts/memory.ts store \
  --persona shared \
  --entity "user" \
  --key "name" \
  --value "Alice" \
  --decay permanent \
  --category preference
```

### Search Memory
```bash
# Full-text search
bun scripts/memory.ts search "birthday"

# Lookup by entity type
bun scripts/memory.ts lookup --entity "user"

# Lookup specific key
bun scripts/memory.ts lookup --entity "user" --key "name"
```

### Maintenance
```bash
# View statistics
bun scripts/memory.ts stats

# Prune expired facts
bun scripts/memory.ts prune

# Apply confidence decay
bun scripts/memory.ts decay
```

### Checkpoints
```bash
# Save current state
bun scripts/memory.ts checkpoint save

# Restore from checkpoint
bun scripts/memory.ts checkpoint restore
```

---

## Decay Tiers

| Tier | TTL | Use Case |
|------|-----|----------|
| `permanent` | Never | Core user facts, preferences |
| `stable` | 90 days | Preferences, recurring decisions |
| `active` | 14 days | Current projects, tasks |
| `session` | 24 hours | Temporary context |
| `checkpoint` | 4 hours | Task state snapshots |

---

## File Structure

```
.zo/memory/
├── shared-facts.db          # SQLite database (this skill)
├── personas/
│   ├── [persona-1].md       # Critical facts per persona
│   └── [persona-2].md
├── checkpoints/
│   └── [timestamp].json     # Saved states
└── scripts/
    ├── memory.ts            # Main CLI
    ├── add-persona.sh       # Persona setup helper
    ├── schema.sql           # Database schema
    └── demo.ts              # Demo script

~/.swarm/
└── swarm-memory.db          # Swarm orchestrator storage
```

---

## Integration

### 1. Add Memory to a Persona

```bash
# Run the helper
bun scripts/add-persona.sh "backend-architect" "System design"

# Edit the created file
file '.zo/memory/personas/backend-architect.md'
```

### 2. Update Persona Prompt

Add this section to any persona prompt:

```markdown
**Memory System**

Before responding:
1. Check persona memory: `file '.zo/memory/personas/[name].md'`
2. Search shared memory: `bun .zo/memory/scripts/memory.ts search "[query]"`
3. Lookup by entity: `bun .zo/memory/scripts/memory.ts lookup --entity "[type]"`

Store new facts:
```bash
bun .zo/memory/scripts/memory.ts store \
  --persona "[name]" \
  --entity "[entity]" \
  --key "[name]" \
  --value "[value]" \
  --decay [permanent|stable|active|session]
```

**Swarm Integration**: When running in swarm mode, outputs may be promoted to memory automatically if `promoteToPersonaMemory: true` is set in the task.
```

### 3. Set Up Maintenance Agent

```bash
# Create scheduled agent for hourly maintenance
zo-agent create \
  --name "memory-maintenance" \
  --schedule "hourly" \
  --command "bun scripts/memory.ts prune && bun scripts/memory.ts decay"
```

---

## Swarm Orchestrator Integration

The zo-swarm-orchestrator skill uses this memory system for:

1. **Persona brief loading** — Each agent gets its persona `.md` file content
2. **Shared memory search** — Contextual facts retrieved by keyword
3. **Fact promotion** — Stable swarm conclusions stored as durable memory

### Cross-Reference

| Skill | Version | Purpose |
|-------|---------|---------|
| zo-memory-system | v1.1.0 | Core persona + shared memory |
| zo-swarm-orchestrator | v4.0.0 | Token-optimized hierarchical memory |

See `file 'Skills/zo-swarm-orchestrator/SKILL.md'` for swarm-specific documentation.

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Zo Persona                 │
│  ┌─────────────────────────────────┐    │
│  │ 1. Load persona.md (critical)   │    │
│  │ 2. Query SQLite (context)       │    │
│  │ 3. Respond with continuity      │    │
│  └─────────────────────────────────┘    │
└──────────────────┬──────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌─────────┐  ┌──────────┐  ┌──────────┐
│persona  │  │  SQLite  │  │  Swarm   │
│.md      │  │  + FTS5  │  │  Memory  │
│(file)   │  │  (db)    │  │  (db)    │
└─────────┘  └──────────┘  └──────────┘
```

---

## Troubleshooting

### Database Locked
```bash
# Find and kill hanging process
lsof .zo/memory/shared-facts.db
# Or restart: rm .zo/memory/shared-facts.db && bun scripts/memory.ts init
```

### FTS5 Not Available
```bash
# Reinstall with FTS5 support
cd scripts && rm -rf node_modules && bun install
```

### Reset Everything
```bash
rm -rf .zo/memory/shared-facts.db .zo/memory/checkpoints/*
bun scripts/memory.ts init
```

### Swarm Memory Not Found
```bash
# Check if swarm database exists
ls -la ~/.swarm/swarm-memory.db

# Initialize swarm memory manually
mkdir -p ~/.swarm
touch ~/.swarm/swarm-memory.db
```

---

## Examples

See `scripts/demo.ts` for a complete walkthrough.

```bash
# Run the demo
bun scripts/demo.ts
```

### Example: Promote Swarm Output to Memory

```bash
# 1. Run swarm task with promotion enabled
# (Task includes "promoteToPersonaMemory": true)

# 2. Verify promoted fact in shared memory
bun scripts/memory.ts search "swarm-promoted"

# 3. Lookup by entity
bun scripts/memory.ts lookup --entity "swarm"
```

---

## Best Practices

### ✅ Do

- Use `permanent` decay for user preferences
- Use `stable` decay for recurring decisions
- Use `active` decay for current project context
- Use `promoteToPersonaMemory` for stable swarm conclusions
- Run maintenance (`prune` + `decay`) hourly

### ⚠️ Avoid

- Storing large blobs (>10KB) in memory
- Using `permanent` for temporary context
- Forgetting to prune old data (bloats database)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2026-02-18 | Added swarm v4 integration documentation, token-optimized memory patterns |
| 1.0.0 | 2026-02-08 | Initial release - SQLite persona memory, 5-tier decay, FTS5 search |

---

## Related Skills

- `zo-swarm-orchestrator` — Multi-agent orchestration with token optimization
- `ffb-hub` — Fauna & Flora business hub with persona skillpacks

