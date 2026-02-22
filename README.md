# Zo Memory System Skill v2.1

Give your Zo Computer personas persistent memory with semantic understanding.

## Prerequisites

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull required models
ollama pull nomic-embed-text   # Embeddings (768d)
ollama pull qwen2.5:1.5b       # HyDE query expansion
```

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

# Hybrid search (semantic + exact)
bun .zo/memory/scripts/memory.ts hybrid "why did we choose SQLite"

# Fast exact search (no vectors)
bun .zo/memory/scripts/memory.ts search "router password" --no-hyde
```

## Performance

| Mode | Latency | Use Case |
|------|---------|----------|
| FTS + Vectors | ~0.5s | Specific queries |
| With HyDE | ~4s | Vague/conceptual queries |

## Documentation

- `SKILL.md` — Full documentation with architecture and configuration
- `scripts/demo.ts` — Interactive demo
- `assets/examples/` — Example persona memory files

## Files

```
zo-memory-system/
├── SKILL.md              # Main documentation (v2.1)
├── README.md             # This file
├── scripts/
│   ├── memory.ts         # Main CLI (parallelized v2.1)
│   ├── add-persona.sh    # Persona setup helper
│   ├── install.sh        # Install to workspace
│   ├── schema.sql        # Database schema
│   ├── demo.ts           # Demo script
│   └── package.json      # Dependencies
└── assets/
    └── examples/         # Example persona memory files
```

## Configuration

```bash
# Environment variables (optional)
export OLLAMA_URL="http://localhost:11434"
export ZO_EMBEDDING_MODEL="nomic-embed-text"
export ZO_HYDE_MODEL="qwen2.5:1.5b"
```

## Updating

```bash
cd /home/workspace/Skills/zo-memory-system
./scripts/install.sh
```
