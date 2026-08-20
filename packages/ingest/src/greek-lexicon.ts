// The Greek lexicon: the Dodson Greek Lexicon, converted to TEI XML by the Biblical
// Humanities project.
//
// WHY THIS EXISTS. Unlike the WLC, MorphGNT carries no Strong's number at all (see
// originals.ts, the comment on `strongs: null` around line 624) — SBLGNT's `lemma` field is
// already a real Greek headword (`λόγος`, not a code), so there was never a Strong's-shaped
// join key on the word side. What was missing was the other half: an English gloss. A Hebrew
// interlinear cell shows surface, headword, gloss and part of speech; the Greek cell showed
// three, because nothing supplied the fourth.
//
// KEYING. The join key here is the LEMMA (headword text), never a Strong's number, because
// `original_words.lemma` for Greek IS the headword already — there is nothing else to join on.
// `entry_key` / `strongs_num` are carried for identity and citation only (Dodson's own `@n`
// attribute encodes both); no query in this codebase looks a Greek word up by Strong's number,
// because MorphGNT never gives one to look up with. See `originals.ts` in apps/web for the
// read-side join, which matches on `headword` first and `search_headword` (diacritic-stripped)
// second — never on `entry_key`.
//
// TWO SOURCE QUIRKS, MEASURED RATHER THAN ASSUMED, NEITHER OF WHICH BLOCKS THE JOIN.
//   - Five `@n` numbers are reused by two different headwords (e.g. both `ἀγγεῖον` and `ἄγγος`
//     carry Strong's "0030" — one Strong's entry that this XML export split across two
//     alphabetized headwords). `entry_key` would collide on a plain `G` + number, so the loader
//     disambiguates the second occurrence with a `.2` suffix — see `makeEntryKey`. It changes
//     nothing about the join key, which is `headword`, not `entry_key`.
//   - Three headwords are reused by two different entries — genuine Greek homographs (`μήν`
//     "truly" vs `μήν` "month"; `βάτος` "bramble" vs `βάτος` the liquid measure; `ἄπειμι` "I am
//     absent" vs "I go away"). A join on `headword` for one of these can land on either sense;
//     the read path breaks the tie deterministically (lowest `entry_key`) rather than guessing
//     further. 3 of 5,410 headwords — well inside the coverage gate's tolerance, and disclosed
//     rather than hidden.
//
// FORMAT. One `<entry n="ἄλφα | 0001">` per headword, flat — no nesting inside `<def>` or
// `<orth>` (verified against the live file: zero inline markup in either). `@n` is
// "headword | zero-padded Strong's number"; `<orth>` is NOT the join key — it carries
// genitive/article information the reference deliberately warns against using as one
// (`Ἀβιληνή, ῆς, ἡ`). `<def role="brief">` is the one-word gloss; `<def role="full">` is the
// fuller definition, and it legitimately contains newlines (894 of 5,410 do) that must be
// collapsed to match the rest of this pipeline's normalization convention.

import { createReadStream } from "node:fs";
import sax from "sax";
import { searchForm } from "./originals.js";

/**
 * The licence, taken from the repository's own LICENSE and README rather than assumed.
 *
 * The README states in its own words: "This lexicon, in all of its forms, is in the public
 * domain." The repository's LICENSE file is the CC0 1.0 Universal text. It is Ulrik
 * Sandborg-Petersen's conversion of Jeffrey Dodson's lexicon, converted to TEI XML by the
 * Biblical Humanities project — credited here even though CC0 waives any legal requirement to,
 * because attribution for public-domain scholarly work is a convention this codebase follows
 * for the Hebrew lexicon too (see HEBREW_LEXICON_ATTRIBUTION) and there is no reason to hold
 * the Greek to a lower bar.
 */
export const GREEK_LEXICON_LICENSE = "CC0 1.0 Universal";
export const GREEK_LEXICON_ATTRIBUTION =
  "Dodson Greek Lexicon (Jeffrey Dodson), digitized by Ulrik Sandborg-Petersen and converted " +
  "to TEI XML by the Biblical Humanities project. Public domain (CC0 1.0 Universal).";
export const GREEK_LEXICON_SOURCE_URL =
  "https://github.com/biblicalhumanities/Dodson-Greek-Lexicon";

export interface GreekLexiconEntryRow {
  /** `G0001`, `G0030`, `G0030.2` for the handful of reused Strong's numbers — see header note. */
  entryKey: string;
  strongsNum: number;
  /** NFC-normalized headword, taken from `@n` (never `<orth>`) — see header note. */
  headword: string;
  /** Diacritic-stripped, lower-cased. The second-pass join key; pairs with `searchForm()`. */
  searchHeadword: string;
  /** Dodson's `role="brief"` definition: the one-word-or-two gloss. */
  gloss: string;
  /** Dodson's `role="full"` definition, whitespace-collapsed. */
  definition: string;
}

/**
 * SAX rather than a regex over `<entry>` blocks, matching the rigour of `lexicon.ts` even
 * though this format turns out to need less of it: verified against the live 5,410-entry file,
 * every entry has exactly one `role="brief"` and one `role="full"` def, `@n` always matches
 * "headword | NNNN", and neither `<def>` nor `<orth>` ever nests another element. The streaming
 * parser still earns its place — `<def role="full">` text spans multiple lines in 894 entries,
 * and a parser that hands over "the text of this element" is what makes collapsing that
 * mechanical rather than regex-fragile.
 */
export async function parseDodson(filePath: string): Promise<GreekLexiconEntryRow[]> {
  const entries: GreekLexiconEntryRow[] = [];
  // Counts occurrences of each padded Strong's number as entries are read, so the SECOND (and
  // any further) entry under a reused number gets a disambiguating suffix. See header note.
  const seenNumbers = new Map<string, number>();

  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: false, normalize: false });

    let pending: { digits: string; headword: string } | null = null;
    let buffer: { role: string; text: string } | null = null;
    let gloss = "";
    let definition = "";

    parser.on("error", (err) => reject(err));

    parser.on("opentag", (node) => {
      const name = node.name.replace(/^.*:/, "");
      const attr = node.attributes as Record<string, string>;

      if (name === "entry") {
        const raw = attr.n ?? "";
        const m = /^(.*)\|\s*(\d+)\s*$/.exec(raw);
        if (!m) {
          // Not a silent skip — see lexicon.ts for why an unrecognised id shape is a hard stop
          // rather than a dropped row: a lexicon quietly missing entries is exactly the failure
          // this table exists to prevent downstream.
          reject(new Error(`Dodson: unrecognised entry "n" attribute "${raw}". Source layout changed.`));
          return;
        }
        pending = { headword: m[1].trim(), digits: m[2] };
        gloss = "";
        definition = "";
        return;
      }
      if (name === "def" && pending) {
        const role = attr.role ?? "";
        if (role === "brief" || role === "full") buffer = { role, text: "" };
      }
    });

    parser.on("text", (t) => {
      if (buffer) buffer.text += t;
    });

    parser.on("closetag", (rawName) => {
      const name = rawName.replace(/^.*:/, "");

      if (name === "def" && buffer) {
        const text = buffer.text.replace(/\s+/g, " ").trim();
        if (buffer.role === "brief") gloss = text;
        else definition = text;
        buffer = null;
        return;
      }
      if (name === "entry" && pending) {
        const strongsNum = Number(pending.digits);
        const base = `G${pending.digits}`;
        const seen = (seenNumbers.get(base) ?? 0) + 1;
        seenNumbers.set(base, seen);
        const entryKey = seen === 1 ? base : `${base}.${seen}`;

        const headword = pending.headword.normalize("NFC");
        entries.push({
          entryKey,
          strongsNum,
          headword,
          searchHeadword: searchForm(headword),
          gloss,
          definition,
        });
        pending = null;
      }
    });

    parser.on("end", () => resolve(entries));
    createReadStream(filePath, { encoding: "utf8" }).pipe(parser);
  });
}
