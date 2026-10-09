// @vitest-environment node
/**
 * Renders every margin note the reader can show, from the real timeline.db, through the real
 * `toledotSentence`, into $NOTES_AUDIT_OUT for a human to read. Skipped unless that is set.
 *   NOTES_AUDIT_OUT=$TMPDIR/all-notes.txt TIMELINE_DB_PATH=... npx vitest run notes.audit
 */
import fs from "node:fs";

import Database from "better-sqlite3";
import { describe, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const out = process.env.NOTES_AUDIT_OUT;

describe.skipIf(!out)("margin note audit", () => {
  it("writes every note", async () => {
    const { getTimelineNotesForRange, getWorkNotesForRange } = await import("@/lib/db/timeline");
    const { toledotSentence } = await import("./notes");
    const db = new Database(process.env.TIMELINE_DB_PATH!, { readonly: true });
    const starts = db
      .prepare(
        `SELECT start_verse_id AS s FROM verse_links UNION SELECT start_verse_id FROM investigation_verses
         UNION SELECT start_verse_id FROM work_verses WHERE start_verse_id < 67000000 ORDER BY s`
      )
      .all() as { s: number }[];
    const lines = new Set<string>();
    for (const { s } of starts) {
      const range = { start: s, end: s } as never;
      for (const n of [...getTimelineNotesForRange(range), ...getWorkNotesForRange(range)]) {
        if (n.start !== s) continue;
        const t = toledotSentence(n);
        lines.add(`${n.start}-${n.end}\t${n.subject.kind}\t${t.lead} — ${t.body}${t.draft ? " [unchecked]" : ""}`);
      }
    }
    fs.writeFileSync(out!, [...lines].join("\n") + "\n");
    console.log(`notes: ${lines.size}`);
  });
});
