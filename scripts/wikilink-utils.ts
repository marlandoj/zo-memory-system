#!/usr/bin/env bun
/**
 * wikilink-utils.ts — Shared wikilink extraction and resolution for the Zouroboros memory system
 *
 * Extracts [[entity]] and [[entity|display]] from text, resolves targets to
 * existing fact IDs or vault_file IDs, and creates stub facts for forward references.
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";

export interface ParsedWikilink {
  raw: string;
  entity: string;
  display: string | null;
}

export interface ResolvedWikilink extends ParsedWikilink {
  targetId: string;
  isStub: boolean;
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function extractWikilinks(text: string): ParsedWikilink[] {
  const results: ParsedWikilink[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(text)) !== null) {
    const entity = m[1].trim();
    if (seen.has(entity)) continue;
    seen.add(entity);
    results.push({
      raw: m[0],
      entity,
      display: m[2]?.trim() || null,
    });
  }

  return results;
}

export function resolveWikilinkTargets(
  db: Database,
  wikilinks: ParsedWikilink[],
  options: { sourcePersona: string; sourceId: string }
): ResolvedWikilink[] {
  const resolved: ResolvedWikilink[] = [];

  const findFact = db.prepare(
    "SELECT id FROM facts WHERE entity = ? AND (expires_at IS NULL OR expires_at > ?) LIMIT 1"
  );
  const findVaultFile = db.prepare(
    "SELECT id FROM vault_files WHERE title = ? COLLATE NOCASE LIMIT 1"
  );
  const nowSec = Math.floor(Date.now() / 1000);

  for (const wl of wikilinks) {
    // 1. Try matching an existing fact by entity name
    const factRow = findFact.get(wl.entity, nowSec) as { id: string } | null;
    if (factRow) {
      resolved.push({ ...wl, targetId: factRow.id, isStub: false });
      continue;
    }

    // 2. Try matching a vault_file by title
    try {
      const vaultRow = findVaultFile.get(wl.entity) as { id: string } | null;
      if (vaultRow) {
        resolved.push({ ...wl, targetId: vaultRow.id, isStub: false });
        continue;
      }
    } catch {
      // vault_files table may not exist yet
    }

    // 3. Forward reference — create stub fact
    const stubId = randomUUID();
    const now = Date.now();
    const nowSecLocal = Math.floor(now / 1000);

    db.prepare(`
      INSERT INTO facts (id, persona, entity, key, value, text, category, decay_class,
                         importance, source, created_at, expires_at, last_accessed, confidence, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      stubId,
      options.sourcePersona,
      wl.entity,
      "stub",
      "",
      `${wl.entity} (forward reference)`,
      "reference",
      "stable",
      0.5,
      `wikilink-stub:${options.sourceId}`,
      now,
      null, // stable = 90 days, but stubs are permanent placeholders
      nowSecLocal,
      0.3,
      JSON.stringify({ stub: true, created_by: options.sourceId })
    );

    resolved.push({ ...wl, targetId: stubId, isStub: true });
  }

  return resolved;
}

export function resolveWikilinksInText(
  db: Database,
  text: string
): Array<{ entity: string; factId: string; value: string }> {
  const wikilinks = extractWikilinks(text);
  if (wikilinks.length === 0) return [];

  const findFact = db.prepare(
    "SELECT id, value FROM facts WHERE entity = ? AND value != '' AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 1"
  );
  const nowSec = Math.floor(Date.now() / 1000);
  const results: Array<{ entity: string; factId: string; value: string }> = [];

  for (const wl of wikilinks) {
    const row = findFact.get(wl.entity, nowSec) as { id: string; value: string } | null;
    if (row && row.value) {
      results.push({ entity: wl.entity, factId: row.id, value: row.value });
    }
  }

  return results;
}
