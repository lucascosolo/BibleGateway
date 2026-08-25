import { toVerseId, type VerseId, type VerseRange } from "@/lib/refs/verse-id";

/**
 * "Windows into the text" — small, curated notes that show something a reader working only
 * from English would not have seen: a Hebrew wordplay, an ancient-Near-East custom, a
 * connection between passages. Never doctrine, never application — always about seeing more
 * of the text itself.
 *
 * Bundled as data, not queried from `bible.db`. This is editorial content curated one verse at
 * a time, the same category as `book_datings` and `book_profiles` in ARCHITECTURE.md §3.5 — it
 * has no upstream dataset to ingest, and a TS module keyed by `verse_id` is the fastest way to
 * add to it without a migration. If this grows past a few hundred rows, or needs to be edited
 * outside a code review, it is a straightforward move to a table in `bible.db` (immutable,
 * rebuilt at will, same shape as `textual_variants`) — nothing about `getInsightNotes`'s
 * signature or the renderer's contract would need to change, because the range-query shape is
 * already the one every other apparatus source in this app uses.
 *
 * Phase 1 (this file): the framework, wired end to end, with a handful of examples so the
 * mechanism is demonstrable. Phase 2: populate it. Adding a note is one array entry; it never
 * requires touching the renderer.
 */

export interface InsightNote {
  /** Stable slug — used as the React key and as a future anchor for editing/linking a note. */
  id: string;
  verseId: VerseId;
  /** One or two sentences, plain language. Not a citation-bearing scholarly claim — see the
   *  module doc — but `source` names where the underlying fact comes from when it helps a
   *  skeptical reader trust it (a lexicon, a standard reference), and is shown quietly rather
   *  than as apparatus. */
  text: string;
  source?: string;
}

const NOTES: readonly InsightNote[] = [
  {
    id: "gen2-7-nephesh",
    verseId: toVerseId(1, 2, 7),
    text: "The Hebrew word for “living being” here (nephesh) doesn't mean an invisible soul tucked inside a body — it names the whole living creature. The text says the man became a nephesh, not that he received one.",
    source: "BDB, nephesh",
  },
  {
    id: "gen4-1-yada",
    verseId: toVerseId(1, 4, 1),
    text: "“Adam knew his wife” uses the Hebrew yada — the same word used for the Lord “knowing” Israel. In Hebrew thought, to know someone is to be bound to them in relationship, not just to hold information about them.",
    source: "BDB, yada",
  },
  {
    id: "gen26-30-covenant-meal",
    verseId: toVerseId(1, 26, 30),
    text: "Isaac and Abimelech seal their treaty by eating together. In the ancient Near East, a covenant was ratified with a shared meal — eating with someone wasn't hospitality, it was signing the contract.",
  },
  {
    id: "deut6-5-lev",
    verseId: toVerseId(5, 6, 5),
    text: "The Hebrew word for “heart” (lev) includes the mind and the will, not just feeling. To love God “with all your heart” is a command about thinking and choosing, not only emotion.",
    source: "BDB, lev",
  },
  {
    id: "isa6-3-kavod",
    verseId: toVerseId(23, 6, 3),
    text: "“Glory” (kavod) literally means weight — substance, not shine. Calling the earth “full of his glory” says the earth is full of the sheer weight of who God is, not full of a glow.",
    source: "BDB, kavod",
  },
];

/** Notes whose verse falls within `range`, in document order. Mirrors the shape of every other
 *  apparatus accessor in `lib/db/originals.ts` and `lib/db/apparatus.ts` on purpose — the reader
 *  page composes this exactly like it composes those, even though this source is static data
 *  rather than a query. */
export function getInsightNotes(range: VerseRange): InsightNote[] {
  return NOTES.filter((note) => note.verseId >= range.start && note.verseId <= range.end);
}
