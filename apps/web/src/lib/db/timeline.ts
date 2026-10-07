import "server-only";

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import type { VerseId, VerseRange } from "@/lib/refs/verse-id";

/**
 * Read-only handle on the Toledot artifact, `data/timeline.db` (built by
 * `packages/timeline/build.py`; contract in `docs/plans/2026-10-06-timeline-backend.md`).
 *
 * A separate database from `bible.db` on purpose, like `audio.db`: the corpus is rebuilt from
 * downloaded text sources, while this is hand-written, cited editorial content that changes on
 * review. They meet only on `verse_id`.
 *
 * FEATURE-DETECTED. Without the file every accessor returns empty or null and never throws, so
 * a deployment that has not built the timeline renders exactly as before.
 *
 * Years are integers, negative = BCE, no year zero (`lib/timeline/years.ts`). Every event's
 * range is the envelope of its positions, derived by the builder.
 */

const DB_PATH =
  process.env.TIMELINE_DB_PATH ?? path.resolve(process.cwd(), "..", "..", "data", "timeline.db");

let instance: Database.Database | null | undefined;

function db(): Database.Database | null {
  if (instance !== undefined) return instance;
  instance = fs.existsSync(DB_PATH) ? new Database(DB_PATH, { readonly: true, fileMustExist: true }) : null;
  return instance;
}

const statements = new Map<string, Database.Statement>();
function prepared(sql: string): Database.Statement | null {
  const handle = db();
  if (!handle) return null;
  let statement = statements.get(sql);
  if (!statement) {
    statement = handle.prepare(sql);
    statements.set(sql, statement);
  }
  return statement;
}

function all<T>(sql: string, ...params: unknown[]): T[] {
  return (prepared(sql)?.all(...params) as T[] | undefined) ?? [];
}

function get<T>(sql: string, ...params: unknown[]): T | null {
  return (prepared(sql)?.get(...params) as T | undefined) ?? null;
}

// --- Types ------------------------------------------------------------------------------------

export type Axis = "narrative" | "composition";
export type ReviewStatus = "draft" | "reviewed";

export interface Citation {
  sourceId: string;
  kind: string;
  title: string;
  author: string | null;
  container: string | null;
  publisher: string | null;
  year: number | null;
  url: string | null;
  locator: string | null;
}

export interface VerseLink {
  start: VerseId;
  end: VerseId;
  linkType: "describes" | "alludes" | "background" | "dates";
  note: string | null;
}

export interface Era {
  id: string;
  name: string;
  start: number;
  end: number;
  summary: string;
  citations: Citation[];
}

export interface EventSummary {
  id: string;
  title: string;
  axis: Axis;
  category: string;
  confidence: "firm" | "contested" | "speculative";
  status: ReviewStatus;
  earliest: number;
  latest: number;
  /** Composition axis only. */
  bookId: number | null;
  segment: string | null;
}

export interface Argument {
  stance: "for" | "against";
  text: string;
  citations: Citation[];
  verses: VerseLink[];
}

export interface Position {
  id: string;
  label: string;
  tradition: string;
  earliest: number;
  latest: number;
  summary: string;
  heldBy: string | null;
  citations: Citation[];
  arguments: Argument[];
}

export type Relation = "corroborates" | "partially-corroborates" | "consistent" | "silent" | "in-tension";

export interface EventAttestation {
  artifactId: string;
  artifactName: string;
  artifactKind: string;
  relation: Relation;
  note: string;
  citations: Citation[];
}

export interface EventDetail extends EventSummary {
  summary: string;
  positions: Position[];
  attestations: EventAttestation[];
  verses: VerseLink[];
  issueIds: string[];
}

export interface ArtifactSummary {
  id: string;
  name: string;
  kind: string;
  /** When the object was made; null when that is not established (never a guess). */
  made: { earliest: number; latest: number } | null;
}

export interface ArtifactDetail extends ArtifactSummary {
  language: string;
  summary: string;
  discovered: { year: number | null; place: string | null } | null;
  heldBy: { institution: string; accession: string | null } | null;
  citations: Citation[];
  verses: VerseLink[];
  attestations: { eventId: string; eventTitle: string; relation: Relation; note: string; citations: Citation[] }[];
}

export interface IssueSummary {
  id: string;
  kind: "chronology" | "textual" | "historical" | "internal";
  title: string;
  status: ReviewStatus;
}

export interface IssueDetail extends IssueSummary {
  summary: string;
  citations: Citation[];
  views: { label: string; text: string; citations: Citation[] }[];
  eventIds: string[];
  verses: VerseLink[];
}

export interface TimelineWindow {
  /** False when no timeline.db is deployed; the lists are then empty. */
  available: boolean;
  eras: Era[];
  events: EventSummary[];
}

// --- Shared lookups ---------------------------------------------------------------------------

type SubjectKind = "era" | "event" | "position" | "argument" | "artifact" | "attestation" | "issue" | "issue_view";

function citationsFor(kind: SubjectKind, id: string | number): Citation[] {
  return all<Citation>(
    `SELECT s.source_id AS sourceId, s.kind, s.title, s.author, s.container, s.publisher, s.year, s.url,
            c.locator
     FROM citations c JOIN sources s ON s.source_id = c.source_id
     WHERE c.subject_kind = ? AND c.subject_id = ?
     ORDER BY c.ordinal`,
    kind,
    String(id)
  );
}

function versesFor(kind: "event" | "argument" | "artifact" | "issue", id: string | number): VerseLink[] {
  return all<VerseLink>(
    `SELECT start_verse_id AS start, end_verse_id AS "end", link_type AS linkType, note
     FROM verse_links WHERE subject_kind = ? AND subject_id = ?
     ORDER BY start_verse_id, link_id`,
    kind,
    String(id)
  );
}

const EVENT_SUMMARY_COLUMNS = `event_id AS id, title, axis, category, confidence, status,
  earliest_year AS earliest, latest_year AS latest, book_id AS bookId, segment_label AS segment`;

// --- Accessors --------------------------------------------------------------------------------

/** Content fingerprint of the deployed timeline, or null when none is deployed. */
export function getTimelineBuildId(): string | null {
  return get<{ value: string }>(`SELECT value FROM meta WHERE key = 'build_id'`)?.value ?? null;
}

/** Events and eras overlapping `[from, to]` (inclusive), earliest first. */
export function getTimelineWindow({ from, to, axis }: { from: number; to: number; axis?: Axis }): TimelineWindow {
  if (!db()) return { available: false, eras: [], events: [] };
  const events = axis
    ? all<EventSummary>(
        `SELECT ${EVENT_SUMMARY_COLUMNS} FROM events
         WHERE axis = ? AND earliest_year <= ? AND latest_year >= ?
         ORDER BY earliest_year, latest_year, event_id`,
        axis,
        to,
        from
      )
    : all<EventSummary>(
        `SELECT ${EVENT_SUMMARY_COLUMNS} FROM events
         WHERE earliest_year <= ? AND latest_year >= ?
         ORDER BY earliest_year, latest_year, event_id`,
        to,
        from
      );
  const eras = all<Omit<Era, "citations">>(
    `SELECT era_id AS id, name, start_year AS start, end_year AS "end", summary FROM eras
     WHERE start_year <= ? AND end_year >= ? ORDER BY start_year, era_id`,
    to,
    from
  ).map((era) => ({ ...era, citations: citationsFor("era", era.id) }));
  return { available: true, eras, events };
}

export function getEvent(id: string): EventDetail | null {
  const row = get<EventSummary & { summary: string }>(
    `SELECT ${EVENT_SUMMARY_COLUMNS}, summary FROM events WHERE event_id = ?`,
    id
  );
  if (!row) return null;

  const positions = all<Omit<Position, "citations" | "arguments">>(
    `SELECT position_id AS id, label, tradition, earliest_year AS earliest, latest_year AS latest,
            summary, held_by AS heldBy
     FROM positions WHERE event_id = ? ORDER BY ordinal`,
    id
  ).map((position) => ({
    ...position,
    citations: citationsFor("position", position.id),
    arguments: all<{ argumentId: number; stance: Argument["stance"]; text: string }>(
      `SELECT argument_id AS argumentId, stance, text FROM arguments WHERE position_id = ? ORDER BY ordinal`,
      position.id
    ).map(({ argumentId, ...argument }) => ({
      ...argument,
      citations: citationsFor("argument", argumentId),
      verses: versesFor("argument", argumentId),
    })),
  }));

  const attestations = all<{ attestationId: number } & Omit<EventAttestation, "citations">>(
    `SELECT t.attestation_id AS attestationId, t.artifact_id AS artifactId, a.name AS artifactName,
            a.kind AS artifactKind, t.relation, t.note
     FROM attestations t JOIN artifacts a ON a.artifact_id = t.artifact_id
     WHERE t.event_id = ? ORDER BY a.made_earliest, a.artifact_id`,
    id
  ).map(({ attestationId, ...attestation }) => ({ ...attestation, citations: citationsFor("attestation", attestationId) }));

  const issueIds = all<{ id: string }>(
    `SELECT issue_id AS id FROM issue_events WHERE event_id = ? ORDER BY issue_id`,
    id
  ).map((issue) => issue.id);

  return { ...row, positions, attestations, verses: versesFor("event", id), issueIds };
}

export function getArtifact(id: string): ArtifactDetail | null {
  const row = get<{
    id: string; name: string; kind: string; madeEarliest: number | null; madeLatest: number | null; language: string;
    summary: string; discoveredYear: number | null; discoveredPlace: string | null;
    institution: string | null; accession: string | null;
  }>(
    `SELECT artifact_id AS id, name, kind, made_earliest AS madeEarliest, made_latest AS madeLatest,
            language, summary, discovered_year AS discoveredYear, discovered_place AS discoveredPlace,
            institution, accession
     FROM artifacts WHERE artifact_id = ?`,
    id
  );
  if (!row) return null;
  const attestations = all<{ attestationId: number; eventId: string; eventTitle: string; relation: Relation; note: string }>(
    `SELECT t.attestation_id AS attestationId, t.event_id AS eventId, e.title AS eventTitle, t.relation, t.note
     FROM attestations t JOIN events e ON e.event_id = t.event_id
     WHERE t.artifact_id = ? ORDER BY e.earliest_year, e.event_id`,
    id
  ).map(({ attestationId, ...attestation }) => ({ ...attestation, citations: citationsFor("attestation", attestationId) }));
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    made: row.madeEarliest !== null && row.madeLatest !== null ? { earliest: row.madeEarliest, latest: row.madeLatest } : null,
    language: row.language,
    summary: row.summary,
    discovered: row.discoveredYear !== null || row.discoveredPlace !== null
      ? { year: row.discoveredYear, place: row.discoveredPlace }
      : null,
    heldBy: row.institution ? { institution: row.institution, accession: row.accession } : null,
    citations: citationsFor("artifact", id),
    verses: versesFor("artifact", id),
    attestations,
  };
}

export function getIssue(id: string): IssueDetail | null {
  const row = get<IssueSummary & { summary: string }>(
    `SELECT issue_id AS id, kind, title, status, summary FROM issues WHERE issue_id = ?`,
    id
  );
  if (!row) return null;
  const views = all<{ viewId: number; label: string; text: string }>(
    `SELECT view_id AS viewId, label, text FROM issue_views WHERE issue_id = ? ORDER BY ordinal`,
    id
  ).map(({ viewId, ...view }) => ({ ...view, citations: citationsFor("issue_view", viewId) }));
  const eventIds = all<{ id: string }>(
    `SELECT event_id AS id FROM issue_events WHERE issue_id = ? ORDER BY event_id`,
    id
  ).map((event) => event.id);
  return { ...row, citations: citationsFor("issue", id), views, eventIds, verses: versesFor("issue", id) };
}

/**
 * Everything on the timeline that a passage touches: events, issues and artifacts with a verse
 * link intersecting the range. An event also counts when one of its ARGUMENTS cites a verse in
 * the range — 1 Kings 6:1 belongs to the Exodus-date debate even though it describes the temple.
 *
 * Interval intersection on real link endpoints; nothing here walks the (sparse) id space.
 */
export function getTimelineForRange(range: VerseRange): {
  events: EventSummary[];
  issues: IssueSummary[];
  artifacts: ArtifactSummary[];
} {
  const events = all<EventSummary>(
    `SELECT ${EVENT_SUMMARY_COLUMNS} FROM events WHERE event_id IN (
       SELECT subject_id FROM verse_links
       WHERE subject_kind = 'event' AND start_verse_id <= ? AND end_verse_id >= ?
       UNION
       SELECT p.event_id FROM verse_links l
       JOIN arguments a ON l.subject_kind = 'argument' AND CAST(a.argument_id AS TEXT) = l.subject_id
       JOIN positions p ON p.position_id = a.position_id
       WHERE l.start_verse_id <= ? AND l.end_verse_id >= ?
     ) ORDER BY earliest_year, event_id`,
    range.end,
    range.start,
    range.end,
    range.start
  );
  const issues = all<IssueSummary>(
    `SELECT issue_id AS id, kind, title, status FROM issues WHERE issue_id IN (
       SELECT subject_id FROM verse_links
       WHERE subject_kind = 'issue' AND start_verse_id <= ? AND end_verse_id >= ?
     ) ORDER BY issue_id`,
    range.end,
    range.start
  );
  const artifacts = all<{ id: string; name: string; kind: string; madeEarliest: number | null; madeLatest: number | null }>(
    `SELECT artifact_id AS id, name, kind, made_earliest AS madeEarliest, made_latest AS madeLatest
     FROM artifacts WHERE artifact_id IN (
       SELECT subject_id FROM verse_links
       WHERE subject_kind = 'artifact' AND start_verse_id <= ? AND end_verse_id >= ?
     ) ORDER BY made_earliest, artifact_id`,
    range.end,
    range.start
  ).map(({ madeEarliest, madeLatest, ...artifact }) => ({
    ...artifact,
    made: madeEarliest !== null && madeLatest !== null ? { earliest: madeEarliest, latest: madeLatest } : null,
  }));
  return { events, issues, artifacts };
}
