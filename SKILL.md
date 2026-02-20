---
name: zo-memory-system
description: Hybrid SQLite + Vector persona memory system for Zo Computer. Gives personas persistent memory with semantic search (nomic-embed-text), HyDE query expansion, 5-tier decay, and swarm integration. Requires Ollama for embeddings.
compatibility: Created for Zo Computer. Requires Bun and Ollama.
metadata:
  author: marlandoj.zo.computer
  updated: 2026-02-19
  version: 2.0.0
---
# Zo Memory System Skill v2.0.0

Give your Zo personas persistent memory with semantic understanding.

**New in v2.0:** Hybrid SQLite + Vector search, HyDE query expansion, semantic retrieval

---

## What You Get

- **Hybrid search** — BM25 (FTS5) + vector similarity with RRF fusion
- **Semantic understanding** — Finds facts even with paraphrased queries
- **HyDE expansion** — Optional query rewriting for vague searches
- **5-tier decay system** — Automatic pruning from session (24h) to permanent (never)
- **Local embeddings** — nomic-embed-text via Ollama (no API costs)
- **Per-persona memory files** — Critical facts always loaded with the persona
- **Shared memory database** — Cross-persona facts with vector index
- **Swarm integration** — Token-optimized memory for multi-agent workflows
- **Scheduled maintenance** — Hourly prune/decay automation
- **Checkpoint system** — Save/restore task state
- **Graceful fallback** — Works without Ollama (FTS5 only)

---

## Prerequisites

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull nomic-embed-text
ollama serve &
```

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

# Search with semantic understanding
bun scripts/memory.ts hybrid "why did we choose the database"
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

**Hybrid Search (v2 — semantic + exact):**
```bash
bun scripts/memory.ts hybrid "database decision rationale"
bun scripts/memory.ts hybrid "why did we pick SQLite" --no-hyde  # Skip HyDE for speed
```

**Fast Exact Search (v1 — FTS5 only):**
```bash
bun scripts/memory.ts search "router password"
```

**Lookup by entity:**
```bash
bun scripts/memory.ts lookup --entity "user"
bun scripts/memory.ts lookup --entity "user" --key "name"
```

### Maintenance
```bash
# View statistics (shows embeddings count)
bun scripts/memory.ts stats

# Backfill embeddings for all facts
bun scripts/memory.ts index

# Prune expired facts
bun scripts/memory.ts prune

# Apply confidence decay
bun scripts/memory.ts decay
```

---

## Architecture

```
.zo/memory/
├── shared-facts.db          # SQLite database
│   ├── facts                # Core facts table
│   ├── facts_fts            # FTS5 virtual table
│   ├── fact_embeddings      # Vector embeddings (768d)
│   └── embedding_cache      # Content hash cache
├── personas/
│   ├── [persona-1].md       # Critical facts per persona
│   └── [persona-2].md
├── checkpoints/
│   └── [timestamp].json     # Saved states
└── scripts/
    ├── memory.ts            # Main CLI (v2)
    ├── add-persona.sh       # Persona setup helper
    └── schema.sql           # Database schema
```

### Search Flow (v2)

```
Query → HyDE Expansion (optional) → Embedding
                    ↓
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
 BM25 (FTS5)   Vector Search    Result Fusion
                    ↓
              RRF + Composite Score
                    ↓
              Ranked Results
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-02-19 | Hybrid SQLite + Vector search, HyDE query expansion, semantic retrieval, nomic-embed-text via Ollama |
| 1.1.0 | 2026-02-18 | Added swarm v4 integration documentation |
| 1.0.0 | 2026-02-08 | Initial release - SQLite persona memory, 5-tier decay, FTS5 search |

---

## Related Skills

- `zo-swarm-orchestrator` — Multi-agent orchestration with token optimization
- `ffb-hub` — Fauna & Flora business hub with persona skillpacks

