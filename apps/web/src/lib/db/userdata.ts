import "server-only";

import Database from "better-sqlite3";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { Annotation } from "@/lib/store/annotations";
import type { VerseId, VerseRange } from "@/lib/refs/verse-id";

/**
 * User data — annotations and preferences.
 *
 * Deliberately a SEPARATE database file from the corpus. `bible.db` is a build artifact that
 * gets rebuilt and redeployed whenever the ingest pipeline changes; user annotations must
 * survive that without a migration dance. Two files, two lifecycles.
 *
 * Schema mirrors ARCHITECTURE.md §3.3 exactly so the eventual move to Postgres (needed the
 * moment this runs on more than one node) is a mechanical port rather than a redesign.
 */

const USER_DB_PATH =
  process.env.USER_DB_PATH ?? path.resolve(process.cwd(), "..", "..", "data", "userdata.db");

let instance: Database.Database | null = null;

export function getUserDb(): Database.Database {
  if (instance) return instance;

  instance = new Database(USER_DB_PATH);
  instance.pragma("journal_mode = WAL"); // concurrent readers during a write
  instance.pragma("foreign_keys = ON");
  instance.pragma("busy_timeout = 5000");

  instance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id      TEXT PRIMARY KEY,
      email        TEXT UNIQUE,
      display_name TEXT,
      preferences  TEXT NOT NULL DEFAULT '{}',
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS annotations (
      annotation_id  TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      kind           TEXT NOT NULL CHECK (kind IN ('highlight','note','bookmark')),

      -- Anchor. NULL offsets mean the whole verse.
      start_verse_id INTEGER NOT NULL,
      end_verse_id   INTEGER NOT NULL,
      start_offset   INTEGER,
      end_offset     INTEGER,
      translation_id INTEGER,
      quoted_text    TEXT,

      color          TEXT,
      body           TEXT,
      tags           TEXT NOT NULL DEFAULT '[]',

      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at     TEXT,
      CHECK (end_verse_id >= start_verse_id)
    );

    -- The index that makes "any view, any passage" a single range scan. Every surface —
    -- tooltip, panel, modal, reader — issues the identical overlap query against it.
    CREATE INDEX IF NOT EXISTS annotations_user_range_idx
      ON annotations (user_id, start_verse_id, end_verse_id)
      WHERE deleted_at IS NULL;
  `);

  return instance;
}

interface AnnotationRow {
  annotation_id: string;
  kind: Annotation["kind"];
  start_verse_id: number;
  end_verse_id: number;
  start_offset: number | null;
  end_offset: number | null;
  translation_id: number | null;
  quoted_text: string | null;
  color: string | null;
  body: string | null;
  tags: string;
  updated_at: string;
}

function toAnnotation(row: AnnotationRow): Annotation {
  return {
    annotationId: row.annotation_id,
    kind: row.kind,
    startVerseId: row.start_verse_id as VerseId,
    endVerseId: row.end_verse_id as VerseId,
    startOffset: row.start_offset,
    endOffset: row.end_offset,
    translationId: row.translation_id ?? 0,
    quotedText: row.quoted_text,
    color: row.color,
    body: row.body,
    tags: JSON.parse(row.tags) as string[],
    updatedAt: row.updated_at,
  };
}

/**
 * Every annotation overlapping a range.
 *
 * This one query serves every view in the app. A tooltip showing John 3:16 passes
 * {start: 43003016, end: 43003016}; the reader showing all of Romans passes the book bounds.
 * Same SQL, same index, different numbers — which is precisely why a highlight made in one
 * surface appears in all the others.
 */
export function getAnnotationsInRange(userId: string, range: VerseRange): Annotation[] {
  const rows = getUserDb()
    .prepare(
      `SELECT annotation_id, kind, start_verse_id, end_verse_id, start_offset, end_offset,
              translation_id, quoted_text, color, body, tags, updated_at
       FROM annotations
       WHERE user_id = ? AND deleted_at IS NULL
         AND start_verse_id <= ? AND end_verse_id >= ?
       ORDER BY start_verse_id, created_at`
    )
    .all(userId, range.end, range.start) as AnnotationRow[];
  return rows.map(toAnnotation);
}

/** All active annotations for the notes index and study export. */
export function getAllAnnotations(userId: string): Annotation[] {
  const rows = getUserDb()
    .prepare(
      `SELECT annotation_id, kind, start_verse_id, end_verse_id, start_offset, end_offset,
              translation_id, quoted_text, color, body, tags, updated_at
       FROM annotations
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC, created_at DESC`,
    )
    .all(userId) as AnnotationRow[];
  return rows.map(toAnnotation);
}

export interface CreateAnnotationInput {
  kind: Annotation["kind"];
  startVerseId: number;
  endVerseId: number;
  startOffset?: number | null;
  endOffset?: number | null;
  translationId?: number | null;
  quotedText?: string | null;
  color?: string | null;
  body?: string | null;
  tags?: string[];
}

export function createAnnotation(userId: string, input: CreateAnnotationInput): Annotation {
  const id = randomUUID();
  getUserDb()
    .prepare(
      `INSERT INTO annotations
         (annotation_id, user_id, kind, start_verse_id, end_verse_id, start_offset, end_offset,
          translation_id, quoted_text, color, body, tags)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      id,
      userId,
      input.kind,
      input.startVerseId,
      input.endVerseId,
      input.startOffset ?? null,
      input.endOffset ?? null,
      input.translationId ?? null,
      input.quotedText ?? null,
      input.color ?? null,
      input.body ?? null,
      JSON.stringify(input.tags ?? [])
    );

  return getAnnotation(userId, id)!;
}

export function getAnnotation(userId: string, annotationId: string): Annotation | null {
  const row = getUserDb()
    .prepare(
      `SELECT annotation_id, kind, start_verse_id, end_verse_id, start_offset, end_offset,
              translation_id, quoted_text, color, body, tags, updated_at
       FROM annotations
       WHERE user_id = ? AND annotation_id = ? AND deleted_at IS NULL`
    )
    .get(userId, annotationId) as AnnotationRow | undefined;
  return row ? toAnnotation(row) : null;
}

export function updateAnnotation(
  userId: string,
  annotationId: string,
  patch: Partial<Pick<CreateAnnotationInput, "color" | "body" | "tags">>
): Annotation | null {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.color !== undefined) (sets.push("color = ?"), values.push(patch.color));
  if (patch.body !== undefined) (sets.push("body = ?"), values.push(patch.body));
  if (patch.tags !== undefined) (sets.push("tags = ?"), values.push(JSON.stringify(patch.tags)));
  if (sets.length === 0) return getAnnotation(userId, annotationId);

  sets.push("updated_at = datetime('now')");
  getUserDb()
    .prepare(
      `UPDATE annotations SET ${sets.join(", ")}
       WHERE user_id = ? AND annotation_id = ? AND deleted_at IS NULL`
    )
    .run(...values, userId, annotationId);

  return getAnnotation(userId, annotationId);
}

/** Soft delete, so a later sync can propagate the removal to other devices. */
export function deleteAnnotation(userId: string, annotationId: string): boolean {
  const result = getUserDb()
    .prepare(
      `UPDATE annotations SET deleted_at = datetime('now'), updated_at = datetime('now')
       WHERE user_id = ? AND annotation_id = ? AND deleted_at IS NULL`
    )
    .run(userId, annotationId);
  return result.changes > 0;
}

/** Ensure a user row exists. Auth comes later; this keeps the FK honest in the meantime. */
export function ensureUser(userId: string, email?: string): void {
  getUserDb()
    .prepare(`INSERT OR IGNORE INTO users (user_id, email) VALUES (?, ?)`)
    .run(userId, email ?? null);
}
