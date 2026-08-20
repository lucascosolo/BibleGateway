import "server-only";

import Database from "better-sqlite3";
import path from "node:path";

/**
 * Read-only handle on the built corpus.
 *
 * `data/bible.db` is a build artifact produced by `packages/ingest`, not user data — it is
 * immutable at runtime, identical for every user, and never written to by the app. That makes
 * a synchronous embedded read the right call: queries are single-digit milliseconds against a
 * memory-mapped file, with no connection pool, no network hop, and no async ceremony in the
 * render path.
 *
 * User data (annotations, preferences) lives in a SEPARATE, writable store. Do not add tables
 * here — the whole point is that this file can be rebuilt and redeployed at any time without
 * touching anything a user created.
 */

const DB_PATH =
  process.env.BIBLE_DB_PATH ?? path.resolve(process.cwd(), "..", "..", "data", "bible.db");

let instance: Database.Database | null = null;

export function getCorpus(): Database.Database {
  if (instance) return instance;

  instance = new Database(DB_PATH, { readonly: true, fileMustExist: true });

  // Read-only tuning. `query_only` makes any accidental write fail loudly rather than
  // silently succeeding against a copy.
  instance.pragma("query_only = true");
  instance.pragma("mmap_size = 268435456"); // 256MB — the whole corpus maps comfortably
  instance.pragma("cache_size = -32000"); // 32MB page cache

  return instance;
}

/**
 * Identity of the corpus this process is serving.
 *
 * The read APIs are deterministic functions of `bible.db`, which is why they can be cached
 * aggressively — but "immutable" is a claim about a *specific* corpus, and the URLs carry no
 * version. Sending year-long immutable caching without one meant a corrected corpus could
 * stay invisible to an existing client for a year. This id is the missing version: it is
 * derived from the corpus contents at ingest, so a rebuild that changes nothing keeps every
 * cache warm and a rebuild that fixes a verse invalidates immediately.
 *
 * Falls back to `"dev"` for a corpus built before `corpus_meta` existed, so a stale local
 * database degrades to short-lived caching rather than failing the request.
 */
let buildId: string | null = null;

export function getCorpusBuildId(): string {
  if (buildId) return buildId;
  try {
    const row = getCorpus()
      .prepare(`SELECT value FROM corpus_meta WHERE key = 'build_id'`)
      .get() as { value: string } | undefined;
    buildId = row?.value ?? "dev";
  } catch {
    buildId = "dev";
  }
  return buildId;
}

export interface CorpusSource {
  key: string;
  name: string;
  url: string;
  sha256: string;
  filename: string;
}

/** Exact upstream artifacts used to build the currently served corpus. */
export function getCorpusSources(): CorpusSource[] {
  try {
    return prepared(
      `SELECT source_key AS key, name, source_url AS url, sha256, filename
       FROM corpus_sources ORDER BY source_key`,
    ).all() as CorpusSource[];
  } catch {
    // A local database built before the manifest table remains readable, but must not pretend
    // that its inputs are known. The public endpoint returns an explicit empty manifest.
    return [];
  }
}

/**
 * Statement cache.
 *
 * better-sqlite3 prepares statements against a specific connection; preparing on every call
 * would dominate the cost of these queries. Keyed by SQL text so callers can just ask.
 */
const statements = new Map<string, Database.Statement>();

export function prepared(sql: string): Database.Statement {
  let stmt = statements.get(sql);
  if (!stmt) {
    stmt = getCorpus().prepare(sql);
    statements.set(sql, stmt);
  }
  return stmt;
}
