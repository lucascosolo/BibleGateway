// Parser for eBible.org USFX distributions — the source of every translation after WEB and BSB.
//
// USFX is eBible's XML serialization of USFM. A verse is a *milestone*, not a container:
//
//   <v id="1" bcv="GEN.1.1" />In the <w s="H7225">beginning</w> …<f caller="+">…</f><ve />
//
// so verse text runs from a `<v/>` to the next `<ve/>`, `<v/>`, `<c/>` or `</book>`, and may
// cross any number of paragraph/poetry elements on the way. `bcv` carries the reference
// directly, which is why this parser never has to infer one from document position.
//
// WHY USFX AND NOT THE getbible JSON THE WEB CAME FROM.
// The getbible distribution of WEB was produced by someone else stripping footnotes out of
// USFM, and they deleted the footnote span without preserving the whitespace around it —
// "The wind blows" became "The windblows" (see normalize-text.ts, and AGENTS.md). Taking the
// publisher's own USFX means *this* pipeline does the stripping, so the defect stops being an
// unknowable property of a third party's build and becomes a property of the code below —
// one that can be checked directly instead of guessed at lexically. `parseUsfx` reports every
// site where removing markup would have joined two word characters; `weldSites` being empty is
// a proof, not a heuristic.
//
// ---------------------------------------------------------------------------------------
// MARKUP IS REMOVED WITH NO SUBSTITUTION, AND THAT IS THE LOAD-BEARING DECISION.
// ---------------------------------------------------------------------------------------
// The obvious choice — replace every tag with a space, then collapse — is wrong, and the KJV
// proves it. Its Strong's tagging splits words across element boundaries in eight places:
//
//   <w s="G4369">shall more be give</w>n.        ->  "given"   with "", "give n." with " "
//   <w s="G1144">with tear</w>s,                 ->  "tears"   with "", "tear s," with " "
//   <w s="G5399">afrai</w>d                      ->  "afraid"  with "", "afrai d"  with " "
//
// The source's own whitespace already sits *outside* the tags wherever a word boundary is
// meant, so removing markup and leaving that whitespace alone reproduces the printed text.
// Measured across all five sources: zero footnote/cross-reference spans have a word character
// on both sides, so removal can never weld two words together.

import { createHash } from "node:crypto";
import unzipper from "unzipper";

/**
 * USFM/USFX book codes in canonical order, so the index is `book_id - 1`.
 *
 * A separate map from `BOOKS.osisId` ("Gen", "Exod", "Phlm") on purpose: USFX speaks USFM
 * three-letter codes ("GEN", "EXO", "PHM") and they are not derivable from the OSIS ids by
 * any rule — EXO/Exod, JOL/Joel, PHP/Phil, JHN/John, MRK/Mark all differ in shape. Spelling
 * the correspondence out is the only honest way to state it, and an unmapped code throws.
 */
const USFM_BOOK_ORDER = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI",
  "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER",
  "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP",
  "HAG", "ZEC", "MAL", "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL",
  "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE",
  "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
] as const;

export const USFM_BOOK_ID: Readonly<Record<string, number>> = Object.fromEntries(
  USFM_BOOK_ORDER.map((code, i) => [code, i + 1]),
);

/**
 * Elements removed WITH their contents, because what is inside them is not scripture.
 *
 * `f`/`fe` footnotes and `x` cross-references are apparatus the publisher prints in the
 * margin. `va`/`vp` are alternate and published verse numbers — numbering, not text. `fig`
 * is a figure caption, `ndx` an index entry, `rem` a translator's remark.
 *
 * Everything NOT listed here has its tags stripped but its text kept: `<w>` (Strong's-tagged
 * word), `<add>` (words supplied by the translator, which the KJV prints in italics and which
 * are unambiguously part of the printed verse), `<wj>` (words of Jesus), `<nd>`, `<q>`, `<p>`.
 */
const REMOVED_SPANS = ["f", "fe", "x", "fig", "ndx", "rem", "va", "vp"] as const;

export interface UsfxVerse {
  bookId: number;
  chapter: number;
  verse: number;
  /** The source's own reference, e.g. `GEN.1.1`. */
  ref: string;
  /** Verse text with all markup removed. NOT yet normalized — the caller does that. */
  text: string;
}

/** A site where removing markup would have joined two word characters. See the header. */
export interface WeldSite {
  ref: string;
  /** The raw source around the removal, so a reviewer can see what happened. */
  context: string;
}

export interface UsfxResult {
  verses: UsfxVerse[];
  /** Source refs the file contains that name a book outside the 66-book canon (DC books). */
  outsideCanon: string[];
  /** MUST be empty. A non-empty list means a footnote removal welded two words. */
  weldSites: WeldSite[];
  /** The verbatim text of the distribution's own `copr.htm`, tags stripped. */
  copyrightFileText: string;
  /** sha256 of the raw `copr.htm` bytes, so a licence change is detectable across rebuilds. */
  copyrightFileSha256: string;
}

export interface ParseUsfxOptions {
  /** Some historical LXX distributions split one printed verse into labelled segments (2a/2b). */
  allowVerseSuffix?: boolean;
}

const XML_ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, (m) => XML_ENTITIES[m])
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)));
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Deletes every match of `pattern`, recording any deletion whose immediate neighbours in the
 * input are both word characters — i.e. every place where the deletion would weld two words.
 *
 * The neighbours are read from the string being scanned, before this pass rewrites it, which
 * is why the removals are applied as one rebuild rather than with `String.replace`: a
 * replace callback sees offsets into the original but the result is assembled as it goes, and
 * conflating the two is how an off-by-one in this exact check goes unnoticed.
 */
function deleteAll(input: string, pattern: RegExp, onWeld: (context: string) => void): string {
  const out: string[] = [];
  let last = 0;
  for (const m of input.matchAll(pattern)) {
    const start = m.index;
    const end = start + m[0].length;
    const before = start > 0 ? input[start - 1] : " ";
    const after = end < input.length ? input[end] : " ";
    if (WORD_CHAR.test(before) && WORD_CHAR.test(after)) {
      onWeld(input.slice(Math.max(0, start - 60), Math.min(input.length, end + 60)));
    }
    out.push(input.slice(last, start));
    last = end;
  }
  out.push(input.slice(last));
  return out.join("");
}

/** Reads one named member out of a zip. Throws if it is not there. */
async function readZipMember(zipPath: string, predicate: (name: string) => boolean, what: string) {
  const directory = await unzipper.Open.file(zipPath);
  const entry = directory.files.find((f) => predicate(f.path));
  if (!entry) {
    throw new Error(`[usfx] no ${what} in ${zipPath}; the archive layout changed`);
  }
  return entry.buffer();
}

/**
 * Parses an eBible USFX zip into verses.
 *
 * `bcv` is trusted for the reference and cross-checked against the enclosing `<book id="…">`;
 * a disagreement throws rather than being resolved, because the two disagreeing is a sign the
 * file is not what this parser thinks it is and every downstream verse id would be a guess.
 */
export async function parseUsfx(zipPath: string, options: ParseUsfxOptions = {}): Promise<UsfxResult> {
  const xml = (await readZipMember(zipPath, (n) => n.endsWith("_usfx.xml"), "*_usfx.xml")).toString("utf-8");
  const coprRaw = await readZipMember(zipPath, (n) => n.endsWith("copr.htm"), "copr.htm");

  const weldSites: WeldSite[] = [];
  const pendingWelds: string[] = [];
  const noteWeld = (context: string) => pendingWelds.push(context);

  // Remove apparatus spans first, from the whole document, so a footnote can never be mistaken
  // for verse text no matter how the verse boundaries fall around it.
  let doc = xml;
  for (const tag of REMOVED_SPANS) {
    doc = deleteAll(doc, new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "g"), noteWeld);
    doc = deleteAll(doc, new RegExp(`<${tag}\\b[^>]*\\/>`, "g"), noteWeld);
  }
  // Anything welded by apparatus removal is a defect and is attributed to the whole file; the
  // context string carries the reference in practice, and there should never be any.
  for (const context of pendingWelds) {
    weldSites.push({ ref: context.match(/bcv="([^"]+)"/)?.[1] ?? "?", context });
  }

  const verses: UsfxVerse[] = [];
  const outsideCanon = new Set<string>();

  // One pass per book, so the `bcv` cross-check has something to check against.
  for (const bookMatch of doc.matchAll(/<book id="([^"]+)"[^>]*>([\s\S]*?)<\/book>/g)) {
    const usfmCode = bookMatch[1];
    const bookId = USFM_BOOK_ID[usfmCode];
    const body = bookMatch[2];

    const boundary = /<v id="[^"]*"[^>]*bcv="([^"]+)"[^>]*\/>/g;
    const marks = [...body.matchAll(boundary)];
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i];
      const ref = m[1];
      const start = m.index + m[0].length;
      // A verse ends at the first of: its verse-end milestone, the next verse, the next
      // chapter, or the end of the book. `<ve/>` alone is not enough — not every USFX file
      // emits it, and a missing one would swallow the rest of the chapter into one verse.
      const rest = body.slice(start, marks[i + 1]?.index ?? body.length);
      const stop = rest.search(/<ve\b[^>]*\/>|<c\b[^>]*\/>/);
      const raw = stop === -1 ? rest : rest.slice(0, stop);

      const parts = ref.split(".");
      if (parts.length !== 3) throw new Error(`[usfx] malformed bcv "${ref}" in ${zipPath}`);
      const [refBook, chapterStr, verseStr] = parts;
      if (bookId === undefined) {
        outsideCanon.add(ref);
        continue;
      }
      if (refBook !== usfmCode) {
        throw new Error(
          `[usfx] verse ${ref} is inside <book id="${usfmCode}">. The bcv attribute and the ` +
            `enclosing book disagree; every verse id derived from this file would be a guess.`,
        );
      }
      const chapter = Number(chapterStr);
      const verseMatch = options.allowVerseSuffix ? verseStr.match(/^(\d+)[a-z]?$/i) : null;
      const verse = Number(verseMatch?.[1] ?? verseStr);
      if (!Number.isInteger(chapter) || !Number.isInteger(verse)) {
        throw new Error(`[usfx] non-numeric chapter/verse in bcv "${ref}" (${zipPath})`);
      }

      // Strip the remaining tags with NO substitution — see the header comment. This is where
      // "give</w>n." becomes "given" rather than "give n.".
      const text = decodeEntities(raw.replace(/<[^>]*>/g, ""))
        // The pilcrow is USFM's paragraph mark rendered into the text stream by the KJV
        // typesetting, not a character of scripture.
        .replace(/¶/g, " ");

      const prior = options.allowVerseSuffix
        ? verses.findIndex((v) => v.bookId === bookId && v.chapter === chapter && v.verse === verse)
        : -1;
      if (prior >= 0) {
        verses[prior] = { ...verses[prior], text: `${verses[prior].text} ${text}`.trim() };
      } else {
        verses.push({ bookId, chapter, verse, ref, text });
      }
    }
  }

  return {
    verses,
    outsideCanon: [...outsideCanon].sort(),
    weldSites,
    copyrightFileText: decodeEntities(coprRaw.toString("utf-8").replace(/<[^>]*>/g, "\n"))
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n"),
    copyrightFileSha256: createHash("sha256").update(coprRaw).digest("hex"),
  };
}
