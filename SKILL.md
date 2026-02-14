---
name: zo-memory-system
description: SQLite-based persona memory system for Zo Computer. Gives personas persistent memory with 5-tier decay, full-text search, and automatic pruning. No external dependencies.
compatibility: Created for Zo Computer. Requires Bun (built-in sqlite support).
metadata:
  author: marlandoj.zo.computer
  version: 1.0.0
---

# Zo Memory System Skill

Give your Zo personas persistent memory without external services.

## What You Get

- **SQLite database** — Fast local storage with FTS5 full-text search
- **5-tier decay system** — Automatic pruning from session (24h) to permanent (never)
- **Per-persona memory files** — Critical facts always loaded with the persona
- **Shared memory database** — Cross-persona facts and context
- **Scheduled maintenance** — Hourly prune/decay automation
- **Checkpoint system** — Save/restore task state

## Quick Start

```bash
# Install the skill
cd /home/workspace/Skills/zo-memory-system

# Initialize the database
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

## Decay Tiers

| Tier | TTL | Use Case |
|------|-----|----------|
| `permanent` | Never | Core user facts, preferences |
| `stable` | 90 days | Preferences, recurring decisions |
| `active` | 14 days | Current projects, tasks |
| `session` | 24 hours | Temporary context |
| `checkpoint` | 4 hours | Task state snapshots |

## File Structure

```
.zo/memory/
├── shared-facts.db          # SQLite database
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
```

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
```

### 3. Set Up Maintenance Agent

```bash
# Create scheduled agent for hourly maintenance
zo-agent create \
  --name "memory-maintenance" \
  --schedule "hourly" \
  --command "bun scripts/memory.ts prune && bun scripts/memory.ts decay"
```

## Architecture

```
┌─────────────────────────────────────────┐
│           Zo Persona                    │
│  ┌─────────────────────────────────┐    │
│  │  1. Load persona.md (critical)  │    │
│  │  2. Query SQLite (context)      │    │
│  │  3. Respond with continuity     │    │
│  └─────────────────────────────────┘    │
└──────────────────┬──────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌─────────┐  ┌──────────┐  ┌──────────┐
│persona  │  │  SQLite  │  │  shared  │
│.md      │  │  + FTS5  │  │  memory  │
│(file)   │  │  (db)    │  │  (db)    │
└─────────┘  └──────────┘  └──────────┘
```

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

## Examples

See `scripts/demo.ts` for a complete walkthrough.

```bash
# Run the demo
bun scripts/demo.ts
```
