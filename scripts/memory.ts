#!/usr/bin/env bun
/**
 * Zo Persona Memory Manager
 * 
 * SQLite-based memory system for Zo Computer personas.
 * Uses Bun's built-in sqlite (no native dependencies).
 * 
 * Usage:
 *   bun memory.ts store --persona shared --entity "user" --key "name" --value "Alice"
 *   bun memory.ts search "daughter birthday"
 *   bun memory.ts lookup --entity "user" --key "preference"
 *   bun memory.ts prune
 *   bun memory.ts stats
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import { join } from "path";

// --- Configuration ---
const DB_PATH = process.env.ZO_MEMORY_DB || "/home/workspace/.zo/memory/shared-facts.db";

// Decay class TTLs in seconds
const TTL_DEFAULTS: Record<string, number | null> = {
  permanent: null,
  stable: 90 * 24 * 3600,   // 90 days
  active: 14 * 24 * 3600,   // 14 days
  session: 24 * 3600,       // 24 hours
  checkpoint: 4 * 3600,     // 4 hours
};

type DecayClass = "permanent" | "stable" | "active" | "session" | "checkpoint";
type Category = "preference" | "fact" | "decision" | "convention" | "other";

interface MemoryEntry {
  id: string;
  persona: string;
  entity: string;
  key: string | null;
  value: string;
  text: string;
  category: Category;
  decayClass: DecayClass;
  importance: number;
  source: string;
  createdAt: number;
  expiresAt: number | null;
  lastAccessed: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

// --- Database Setup ---
let db: Database;
let dbInitialized = false;

async function initDb(): Promise<Database> {
  if (dbInitialized && db) return db;
  
  db = new Database(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  
  // Load and execute schema
  const schemaPath = join(import.meta.dir, "schema.sql");
  const schema = await Bun.file(schemaPath).text();
  db.exec(schema);
  
  dbInitialized = true;
  return db;
}

// --- Decay Classification ---
function classifyDecay(entity: string, key: string | null, value: string): DecayClass {
  const text = `${entity} ${key || ""} ${value}`.toLowerCase();
  
  // Permanent: identities, birthdays, decisions with rationale
  if (/birthday|name|email|decided|chose|always|never/i.test(text)) {
    return "permanent";
  }
  // Active: current tasks, temporary state
  if (/currently|working on|sprint|this week|debugging/i.test(text)) {
    return "active";
  }
  // Session: immediate context
  if (/checkpoint|temp|temporary|right now/i.test(text)) {
    return "session";
  }
  // Default to stable
  return "stable";
}

function calculateExpiry(decayClass: DecayClass, fromSec: number): number | null {
  const ttl = TTL_DEFAULTS[decayClass];
  return ttl === null ? null : fromSec + ttl;
}

// --- Store Operations ---
async function store(entry: Omit<MemoryEntry, "id" | "createdAt" | "expiresAt" | "lastAccessed">): Promise<MemoryEntry> {
  const db = await initDb();
  const id = randomUUID();
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  
  const decayClass = entry.decayClass || classifyDecay(entry.entity, entry.key, entry.value);
  const expiresAt = calculateExpiry(decayClass, nowSec);
  
  db.prepare(`
    INSERT INTO facts (id, persona, entity, key, value, text, category, decay_class, 
                       importance, source, created_at, expires_at, last_accessed, confidence, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    entry.persona,
    entry.entity,
    entry.key,
    entry.value,
    entry.text || `${entry.entity} ${entry.key || ""}: ${entry.value}`,
    entry.category,
    decayClass,
    entry.importance,
    entry.source,
    now,
    expiresAt,
    nowSec,
    entry.confidence,
    entry.metadata ? JSON.stringify(entry.metadata) : null
  );
  
  return {
    ...entry,
    id,
    createdAt: now,
    expiresAt,
    lastAccessed: nowSec,
  };
}

// --- Search Operations ---
async function search(query: string, options: {
  persona?: string;
  limit?: number;
  includeExpired?: boolean;
} = {}): Promise<Array<{ entry: MemoryEntry; score: number }>> {
  const db = await initDb();
  const { persona, limit = 5, includeExpired = false } = options;
  const nowSec = Math.floor(Date.now() / 1000);
  
  // Build FTS query
  const safeQuery = query
    .replace(/['"]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => `"${w}"`)
    .join(" OR ");
  
  if (!safeQuery) return [];
  
  // Query with optional persona filter
  let sql = `
    SELECT f.*, rank,
      CASE
        WHEN f.expires_at IS NULL THEN 1.0
        WHEN f.expires_at <= ? THEN 0.0
        ELSE MIN(1.0, CAST(f.expires_at - ? AS REAL) / 604800)
      END AS freshness
    FROM facts f
    JOIN facts_fts fts ON f.rowid = fts.rowid
    WHERE facts_fts MATCH ?
      ${includeExpired ? "" : "AND (f.expires_at IS NULL OR f.expires_at > ?)"}
      ${persona ? "AND f.persona = ?" : ""}
    ORDER BY rank
    LIMIT ?
  `;
  
  const params: (string | number)[] = [nowSec, nowSec, safeQuery];
  if (!includeExpired) params.push(nowSec);
  if (persona) params.push(persona);
  params.push(limit * 2);
  
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  
  if (rows.length === 0) return [];
  
  // Calculate scores and refresh accessed facts
  const minRank = Math.min(...rows.map((r) => r.rank as number));
  const maxRank = Math.max(...rows.map((r) => r.rank as number));
  const range = maxRank - minRank || 1;
  
  const results = rows.map((row) => {
    const bm25Score = 1 - ((row.rank as number) - minRank) / range || 0.8;
    const freshness = (row.freshness as number) || 1.0;
    const confidence = (row.confidence as number) || 1.0;
    const composite = bm25Score * 0.6 + freshness * 0.25 + confidence * 0.15;
    
    return {
      entry: rowToEntry(row),
      score: composite,
    };
  });
  
  results.sort((a, b) => b.score - a.score);
  const topResults = results.slice(0, limit);
  
  // Refresh TTL on accessed stable/active facts
  await refreshAccessed(topResults.map((r) => r.entry.id));
  
  return topResults;
}

async function lookup(entity: string, key?: string, persona?: string): Promise<Array<{ entry: MemoryEntry; score: number }>> {
  const db = await initDb();
  const nowSec = Math.floor(Date.now() / 1000);
  
  let sql = `SELECT * FROM facts WHERE lower(entity) = lower(?)`;
  const params: (string | number)[] = [entity];
  
  if (key) {
    sql += ` AND lower(key) = lower(?)`;
    params.push(key);
  }
  
  if (persona) {
    sql += ` AND persona = ?`;
    params.push(persona);
  }
  
  sql += ` AND (expires_at IS NULL OR expires_at > ?) ORDER BY confidence DESC, created_at DESC`;
  params.push(nowSec);
  
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  const results = rows.map((row) => ({
    entry: rowToEntry(row),
    score: (row.confidence as number) || 1.0,
  }));
  
  await refreshAccessed(results.map((r) => r.entry.id));
  return results;
}

function rowToEntry(row: Record<string, unknown>): MemoryEntry {
  return {
    id: row.id as string,
    persona: row.persona as string,
    entity: row.entity as string,
    key: row.key as string | null,
    value: row.value as string,
    text: row.text as string,
    category: row.category as Category,
    decayClass: (row.decay_class as DecayClass) || "stable",
    importance: (row.importance as number) || 1.0,
    source: row.source as string,
    createdAt: row.created_at as number,
    expiresAt: row.expires_at as number | null,
    lastAccessed: row.last_accessed as number,
    confidence: (row.confidence as number) || 1.0,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
  };
}

async function refreshAccessed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await initDb();
  const nowSec = Math.floor(Date.now() / 1000);
  
  const stmt = db.prepare(`
    UPDATE facts
    SET last_accessed = @now,
        expires_at = CASE decay_class
          WHEN 'stable' THEN @now + @stableTtl
          WHEN 'active' THEN @now + @activeTtl
          ELSE expires_at
        END
    WHERE id = @id
      AND decay_class IN ('stable', 'active')
  `);
  
  db.transaction(() => {
    for (const id of ids) {
      stmt.run({
        now: nowSec,
        stableTtl: TTL_DEFAULTS.stable,
        activeTtl: TTL_DEFAULTS.active,
        id,
      });
    }
  })();
}

// --- Maintenance Operations ---
async function pruneExpired(): Promise<number> {
  const db = await initDb();
  const nowSec = Math.floor(Date.now() / 1000);
  const result = db.prepare(`DELETE FROM facts WHERE expires_at IS NOT NULL AND expires_at < ?`).run(nowSec);
  return result.changes;
}

async function decayConfidence(): Promise<number> {
  const db = await initDb();
  const nowSec = Math.floor(Date.now() / 1000);
  
  // Decay confidence for facts nearing expiration
  db.prepare(`
    UPDATE facts
    SET confidence = confidence * 0.5
    WHERE expires_at IS NOT NULL
      AND expires_at > @now
      AND last_accessed IS NOT NULL
      AND (@now - last_accessed) > (expires_at - last_accessed) * 0.75
      AND confidence > 0.1
  `).run({ now: nowSec });
  
  // Delete low-confidence facts
  const result = db.prepare(`DELETE FROM facts WHERE confidence < 0.1`).run();
  return result.changes;
}

async function stats(): Promise<Record<string, unknown>> {
  const db = await initDb();
  
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM facts`).get() as { cnt: number };
  const expired = db.prepare(`SELECT COUNT(*) as cnt FROM facts WHERE expires_at IS NOT NULL AND expires_at < ?`)
    .get(Math.floor(Date.now() / 1000)) as { cnt: number };
  
  const byDecay = db.prepare(`SELECT decay_class, COUNT(*) as cnt FROM facts GROUP BY decay_class`)
    .all() as Array<{ decay_class: string; cnt: number }>;
  
  const byPersona = db.prepare(`SELECT persona, COUNT(*) as cnt FROM facts GROUP BY persona`)
    .all() as Array<{ persona: string; cnt: number }>;
  
  return {
    total: total.cnt,
    expired: expired.cnt,
    byDecay: Object.fromEntries(byDecay.map((r) => [r.decay_class, r.cnt])),
    byPersona: Object.fromEntries(byPersona.map((r) => [r.persona, r.cnt])),
  };
}

// --- Checkpoint Operations ---
async function saveCheckpoint(context: {
  intent: string;
  state: string;
  expectedOutcome?: string;
  workingFiles?: string[];
  persona?: string;
}): Promise<string> {
  const data = JSON.stringify({
    ...context,
    savedAt: new Date().toISOString(),
  });
  
  const entry = await store({
    persona: context.persona || "shared",
    entity: "system",
    key: `checkpoint:${Date.now()}`,
    value: context.intent.slice(0, 100),
    text: data,
    category: "other",
    decayClass: "checkpoint",
    importance: 0.9,
    source: "checkpoint",
    confidence: 1.0,
  });
  
  return entry.id;
}

async function restoreCheckpoint(persona?: string): Promise<{
  id: string;
  intent: string;
  state: string;
  expectedOutcome?: string;
  workingFiles?: string[];
  savedAt: string;
} | null> {
  const db = await initDb();
  const nowSec = Math.floor(Date.now() / 1000);
  
  let sql = `
    SELECT id, value, text FROM facts
    WHERE entity = 'system' AND key LIKE 'checkpoint:%'
      AND (expires_at IS NULL OR expires_at > ?)
  `;
  const params: (string | number)[] = [nowSec];
  
  if (persona) {
    sql += ` AND persona = ?`;
    params.push(persona);
  }
  
  sql += ` ORDER BY created_at DESC LIMIT 1`;
  
  const row = db.prepare(sql).get(...params) as { id: string; value: string; text: string } | undefined;
  
  if (!row) return null;
  
  try {
    return { id: row.id, ...JSON.parse(row.text) };
  } catch {
    return null;
  }
}

// --- CLI Interface ---
function printUsage() {
  console.log(`
Zo Persona Memory Manager

Usage:
  bun memory.ts <command> [options]

Commands:
  store     Store a new fact
  search    Search facts by text
  lookup    Lookup facts by entity/key
  checkpoint  Save or restore checkpoints
  prune     Remove expired facts
  decay     Apply confidence decay
  stats     Show memory statistics

Store options:
  --persona <name>     Persona scope (default: shared)
  --entity <name>      Entity name (required)
  --key <name>         Key/attribute (optional)
  --value <text>       Value (required)
  --category <type>    preference|fact|decision|convention|other
  --decay <class>      permanent|stable|active|session|checkpoint
  --source <text>      Where this came from
  --text <text>        Full context for search

Search options:
  --persona <name>     Filter by persona
  --limit <n>          Max results (default: 5)
  --expired            Include expired facts

Lookup options:
  --entity <name>      Entity to lookup (required)
  --key <name>         Specific key (optional)
  --persona <name>     Filter by persona

Checkpoint options:
  save --intent <text> --state <text> [--persona <name>]
  restore [--persona <name>]

Examples:
  bun memory.ts store --entity "user" --key "name" --value "Alice"
  bun memory.ts search "project deadline" --limit 10
  bun memory.ts lookup --entity "user" --key "preference"
  bun memory.ts checkpoint save --intent "Refactor auth" --state "Starting login.ts"
  bun memory.ts checkpoint restore
  bun memory.ts prune
  bun memory.ts stats
`);
}

async function main() {
  // Initialize DB on startup
  await initDb();
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === "help" || command === "--help") {
    printUsage();
    process.exit(0);
  }
  
  // Parse flags
  const flags: Record<string, string> = {};
  for (let i = 1; i < args.length; i += 2) {
    if (args[i].startsWith("--")) {
      flags[args[i].slice(2)] = args[i + 1] || "";
    }
  }
  
  switch (command) {
    case "store": {
      if (!flags.entity || !flags.value) {
        console.error("Error: --entity and --value are required");
        process.exit(1);
      }
      const entry = await store({
        persona: flags.persona || "shared",
        entity: flags.entity,
        key: flags.key || null,
        value: flags.value,
        text: flags.text || `${flags.entity} ${flags.key || ""}: ${flags.value}`,
        category: (flags.category as Category) || "fact",
        decayClass: (flags.decay as DecayClass) || "stable",
        importance: parseFloat(flags.importance) || 1.0,
        source: flags.source || "cli",
        confidence: 1.0,
      });
      console.log(`Stored: ${entry.id} (expires: ${entry.expiresAt ? new Date(entry.expiresAt * 1000).toISOString() : "never"})`);
      break;
    }
    
    case "search": {
      const query = args.slice(1).find((a) => !a.startsWith("--")) || "";
      if (!query) {
        console.error("Error: search query required");
        process.exit(1);
      }
      const results = await search(query, {
        persona: flags.persona,
        limit: parseInt(flags.limit) || 5,
        includeExpired: flags.expired === "true",
      });
      console.log(`Found ${results.length} results:\n`);
      for (const { entry, score } of results) {
        console.log(`[${entry.decayClass}] ${entry.entity}.${entry.key || "_"} = ${entry.value.slice(0, 80)}`);
        console.log(`    score: ${score.toFixed(3)} | persona: ${entry.persona} | source: ${entry.source}`);
        console.log();
      }
      break;
    }
    
    case "lookup": {
      if (!flags.entity) {
        console.error("Error: --entity is required");
        process.exit(1);
      }
      const results = await lookup(flags.entity, flags.key || undefined, flags.persona);
      console.log(`Found ${results.length} results:\n`);
      for (const { entry } of results) {
        console.log(`${entry.key || "(no key)"}: ${entry.value}`);
        console.log(`    decay: ${entry.decayClass} | confidence: ${entry.confidence.toFixed(2)}`);
        console.log();
      }
      break;
    }
    
    case "checkpoint": {
      const subcmd = args[1];
      if (subcmd === "save") {
        if (!flags.intent || !flags.state) {
          console.error("Error: --intent and --state are required");
          process.exit(1);
        }
        const id = await saveCheckpoint({
          intent: flags.intent,
          state: flags.state,
          expectedOutcome: flags.expected,
          workingFiles: flags.files ? flags.files.split(",") : undefined,
          persona: flags.persona,
        });
        console.log(`Checkpoint saved: ${id}`);
      } else if (subcmd === "restore") {
        const cp = await restoreCheckpoint(flags.persona);
        if (cp) {
          console.log("Restored checkpoint:");
          console.log(JSON.stringify(cp, null, 2));
        } else {
          console.log("No checkpoint found");
        }
      } else {
        console.error("Error: checkpoint requires 'save' or 'restore'");
        process.exit(1);
      }
      break;
    }
    
    case "prune": {
      const count = await pruneExpired();
      console.log(`Pruned ${count} expired facts`);
      break;
    }
    
    case "decay": {
      const count = await decayConfidence();
      console.log(`Decayed ${count} low-confidence facts`);
      break;
    }
    
    case "stats": {
      const s = await stats();
      console.log("Memory Statistics:");
      console.log(`  Total facts: ${s.total}`);
      console.log(`  Expired facts: ${s.expired}`);
      console.log(`  By decay class:`, s.byDecay);
      console.log(`  By persona:`, s.byPersona);
      break;
    }
    
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch(console.error);
