/**
 * Standalone repair for `verse_reference_heat`.
 *
 * The original materialization used a range join
 * (`v.verse_id BETWEEN x.to_start_verse AND x.to_end_verse`), which SQLite cannot index —
 * 31k verses x 345k references is ~10.7 billion comparisons and never completes. This
 * rebuilds the table with the range-expansion algorithm now used in ingest.ts step 10.
 *
 * Run:  npx tsx src/fix-heat.ts
 */
import Database from "better-sqlite3";
import { resolve } from "node:path";

const DB_PATH = resolve(import.meta.dirname, "../../../data/bible.db");

// Widest legitimate cross-reference target is a long chapter; past this is bad data.
const MAX_RANGE_SPAN = 400;

const db = new Database(DB_PATH);
const started = Date.now();

const targets = db
  .prepare(`SELECT to_start_verse AS s, to_end_verse AS e, votes AS v FROM cross_references`)
  .all() as { s: number; e: number; v: number }[];

const inboundCount = new Map<number, number>();
const weightedScore = new Map<number, number>();
let malformedRanges = 0;

for (const row of targets) {
  const start = row.s;
  const end = row.e < start ? start : row.e;
  if (end - start > MAX_RANGE_SPAN) malformedRanges++;
  const capped = Math.min(end, start + MAX_RANGE_SPAN);
  const weight = Math.max(row.v ?? 0, 1);
  for (let id = start; id <= capped; id++) {
    inboundCount.set(id, (inboundCount.get(id) ?? 0) + 1);
    weightedScore.set(id, (weightedScore.get(id) ?? 0) + weight);
  }
}

// Verse IDs are sparse (BBCCCVVV), so ranges crossing a chapter or book boundary generate
// ids that do not exist. Keep only real verses.
const realVerseIds = new Set(
  (db.prepare(`SELECT verse_id FROM verses`).all() as { verse_id: number }[]).map((r) => r.verse_id)
);

const heatRows = [...inboundCount.entries()]
  .filter(([verseId]) => realVerseIds.has(verseId))
  .sort((a, b) => a[1] - b[1]); // ascending, so bucket 5 is the hottest

if (heatRows.length === 0) {
  throw new Error("refusing to write an empty heat table — cross_references may be missing");
}

const insert = db.prepare(
  `INSERT INTO verse_reference_heat (verse_id, inbound_count, weighted_score, heat_bucket)
   VALUES (?, ?, ?, ?)`
);

db.transaction(() => {
  db.prepare(`DELETE FROM verse_reference_heat`).run();
  heatRows.forEach(([verseId, count], i) => {
    const bucket = Math.min(5, Math.floor((i * 5) / heatRows.length) + 1);
    insert.run(verseId, count, weightedScore.get(verseId)!, bucket);
  });
})();

const written = (db.prepare(`SELECT COUNT(*) AS n FROM verse_reference_heat`).get() as { n: number }).n;
console.log(`heat rows written: ${written} (${Date.now() - started}ms)`);
if (malformedRanges > 0) console.log(`capped ${malformedRanges} over-wide ranges`);

console.log("\ntop 12 most-referenced verses:");
console.table(
  db
    .prepare(
      `SELECT v.osis_ref, h.inbound_count, h.weighted_score, h.heat_bucket
       FROM verse_reference_heat h JOIN verses v ON v.verse_id = h.verse_id
       ORDER BY h.inbound_count DESC LIMIT 12`
    )
    .all()
);

console.log("\nbucket distribution:");
console.table(
  db
    .prepare(
      `SELECT heat_bucket, COUNT(*) AS verses, MIN(inbound_count) AS min_refs, MAX(inbound_count) AS max_refs
       FROM verse_reference_heat GROUP BY heat_bucket ORDER BY heat_bucket`
    )
    .all()
);

db.pragma("wal_checkpoint(TRUNCATE)");
db.close();
