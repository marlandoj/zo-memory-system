---
name: zo-memory-system
description: Hybrid SQLite + Vector persona memory system for Zo Computer. Gives personas persistent memory with semantic search (nomic-embed-text), HyDE query expansion (qwen2.5:1.5b), 5-tier decay, and swarm integration. Requires Ollama for embeddings.
compatibility: Created for Zo Computer. Requires Bun and Ollama.
metadata:
  author: marlandoj.zo.computer
  updated: 2026-02-22
  version: 2.2.0
---
# Zo Memory System Skill v2.2.0

Give your Zo personas persistent memory with semantic understanding.

**v2.2 Updates:** Ollama health checks, fetch timeouts, prune/decay/consolidate/link/graph commands, vector pre-filtering, adaptive decay, associative routing

---

## What You Get

- **Hybrid search** — BM25 (FTS5) + vector similarity with RRF fusion
- **Semantic understanding** — Finds facts even with paraphrased queries
- **HyDE expansion** — qwen2.5:1.5b query rewriting for vague searches (parallelized)
- **5-tier adaptive decay** — Automatic promotion/demotion based on access patterns
- **Local embeddings** — nomic-embed-text (768d) via Ollama (no API costs)
- **Per-persona memory files** — Critical facts always loaded with the persona
- **Shared memory database** — Cross-persona facts with vector index
- **Associative routing** — Graph links between related facts (link/graph commands)
- **Memory consolidation** — Automatic deduplication and merging of related facts
- **Swarm integration** — Token-optimized memory for multi-agent workflows
- **Health checks** — Ollama connectivity and model validation at startup
- **Fetch timeouts** — 15s timeout on all Ollama calls (prevents indefinite hangs)
- **Scheduled maintenance** — Hourly prune/decay automation
- **Checkpoint system** — Save/restore task state
- **Graceful fallback** — Works without Ollama (FTS5 only)

---

## Prerequisites

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull required models
ollama pull nomic-embed-text   # Embeddings (768 dimensions)
ollama pull qwen2.5:1.5b       # HyDE query expansion (fast, ~1s generation)

# Start Ollama (if not running)
ollama serve &
```

### Model Selection

| Model | Purpose | Size | Why |
|-------|---------|------|-----|
| `nomic-embed-text` | Vector embeddings | 274 MB | Best open embedding model, 768d |
| `qwen2.5:1.5b` | HyDE expansion | 986 MB | Fast generation, good quality for query rewriting |

**Note:** Avoid larger models for HyDE (e.g., qwen3:30b) — the extra quality is wasted on query expansion and adds significant latency.

---

## Performance

| Mode | Latency | Use Case |
|------|---------|----------|
| **FTS + Vectors only** | ~0.5s | Specific queries with exact keywords |
| **With HyDE** | ~4s | Vague/conceptual queries (e.g., "that thing about data safety") |

**HyDE Trade-off:** Adds ~3.5s but dramatically improves recall for vague queries (1 result → 6 results in testing).

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
# View statistics (shows embeddings count, model config)
bun scripts/memory.ts stats

# Check Ollama health and model availability
bun scripts/memory.ts health

# Backfill embeddings for all facts
bun scripts/memory.ts index

# Prune expired facts and orphaned embeddings
bun scripts/memory.ts prune

# Apply adaptive decay (demotes stale, promotes frequently-accessed)
bun scripts/memory.ts decay

# Consolidate duplicate facts (merge same entity+key entries)
bun scripts/memory.ts consolidate
```

### Associative Routing (Graph Links)
```bash
# Link two related facts
bun scripts/memory.ts link --source <id1> --target <id2> --relation "related"

# View links for a fact or entity
bun scripts/memory.ts graph --entity "user"
bun scripts/memory.ts graph --id <fact-id>
```

---

## Architecture

```
.zo/memory/
├── shared-facts.db          # SQLite database
│   ├── facts                # Core facts table
│   ├── facts_fts            # FTS5 virtual table
│   ├── fact_embeddings      # Vector embeddings (768d)
│   ├── fact_links           # Associative routing graph
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

### Search Flow (v2.1 — Parallelized)

```
Query → ┌─────────────────────────────────────┐
        │  Parallel Execution                 │
        │  ├── HyDE Expansion (qwen2.5:1.5b)  │
        │  ├── Query Embedding (nomic-embed)  │
        │  └── FTS5 Search (BM25)             │
        └─────────────────────────────────────┘
                        ↓
              RRF Fusion + Composite Score
                        ↓
              Ranked Results
```

---

## Configuration

Environment variables (optional):

```bash
export OLLAMA_URL="http://localhost:11434"      # Default
export ZO_EMBEDDING_MODEL="nomic-embed-text"    # Default
export ZO_HYDE_MODEL="qwen2.5:1.5b"             # Default
export ZO_HYDE_DEFAULT="true"                   # Default: use HyDE
export ZO_MEMORY_DB="/path/to/shared-facts.db"  # Default: .zo/memory/
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.2.0 | 2026-02-27 | Ollama health check, fetch timeouts, prune/decay/consolidate/link/graph commands, vector pre-filtering, adaptive decay, associative routing, PRAGMA busy_timeout |
| 2.1.0 | 2026-02-22 | Parallelized HyDE/FTS/embedding execution, optimized for qwen2.5:1.5b, performance docs |
| 2.0.0 | 2026-02-19 | Hybrid SQLite + Vector search, HyDE query expansion, semantic retrieval, nomic-embed-text via Ollama |
| 1.1.0 | 2026-02-18 | Added swarm v4 integration documentation |
| 1.0.0 | 2026-02-08 | Initial release - SQLite persona memory, 5-tier decay, FTS5 search |

---

## Related Skills

- `zo-swarm-orchestrator` — Multi-agent orchestration with token optimization

