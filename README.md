# Zo Memory System Skill

Give your Zo Computer personas persistent memory using SQLite.

## Installation

```bash
cd /home/workspace/Skills/zo-memory-system
./scripts/install.sh
```

## Quick Start

```bash
# Initialize database
bun .zo/memory/scripts/memory.ts init

# Add a persona
bun .zo/memory/scripts/add-persona.sh "backend-architect" "System design"

# Store a fact
bun .zo/memory/scripts/memory.ts store \
  --entity "user" \
  --key "preference" \
  --value "value" \
  --decay permanent

# Search
bun .zo/memory/scripts/memory.ts search "query"
```

## Documentation

- `SKILL.md` — Full documentation
- `scripts/demo.ts` — Interactive demo
- `assets/examples/` — Example persona memory files

## Files

```
zo-memory-system/
├── SKILL.md              # Main documentation
├── README.md             # This file
├── scripts/
│   ├── memory.ts         # Main CLI
│   ├── add-persona.sh    # Persona setup helper
│   ├── install.sh        # Install to workspace
│   ├── schema.sql        # Database schema
│   ├── demo.ts           # Demo script
│   └── package.json      # Dependencies
└── assets/
    └── examples/         # Example persona memory files
```

## Updating

To update the skill after changes:

```bash
cd /home/workspace/Skills/zo-memory-system
./scripts/install.sh
```

This will copy the latest scripts to `.zo/memory/`.
