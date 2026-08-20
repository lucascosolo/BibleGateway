/**
 * Verse text normalization and source repair.
 *
 * Normalizes verse text for storage: Unicode NFC, no markup, no footnote markers, no
 * embedded verse numbers, single-spaced. Whitespace collapsing is required for character
 * offset stability, because annotation anchors are (verse_id, startOffset, endOffset) —
 * see ARCHITECTURE.md §3.1. If normalization ever changes, every stored anchor shifts.
 *
 * ---------------------------------------------------------------------------
 * Why there is a repair stage at all
 * ---------------------------------------------------------------------------
 * The WEB JSON distribution we ingest was produced by stripping USFM footnotes
 * (`\f + \ft … \f*`) out of the publisher's text. The producer deleted the footnote span
 * but not the whitespace that surrounded it, so wherever a footnote sat mid-sentence the
 * two neighbouring tokens were welded together:
 *
 *     "The wind blows where it wants to"   ->  "The windblows where it wants to"   (John 3:8)
 *     "Get behind me, Satan!"              ->  "Get behind me,Satan!"              (Matt 4:10)
 *
 * and in two verses the stripping failed outright, leaving the raw marker and the footnote
 * body inline as if it were scripture (Gen 3:24, Zech 14:5).
 *
 * Shipping that is not acceptable in a tool meant for study: it is silent corruption of the
 * primary text, in the one place a reader cannot be expected to notice it. So we repair it
 * here, where the repair is visible, reviewable, and tested — never at render time, where it
 * would be invisible and would desynchronize offsets from what is stored.
 */

/** Footnote residue the upstream producer failed to strip: `/f + <body> /f*`. */
const FOOTNOTE_RESIDUE = /\/f\s*\+.*?\/f\*/gs;

/**
 * A footnote removed from mid-sentence leaves punctuation welded to the next word:
 * `me,Satan` → `me, Satan`. Safe as a blanket rule for this corpus: a lowercase letter,
 * then sentence punctuation, then a letter with no space is not a construction that occurs
 * in English scripture prose (no abbreviations like "e.g." appear in either translation —
 * asserted by `assertNoTextArtifacts`, which re-scans after repair).
 */
const WELDED_PUNCTUATION = /([a-z])([.,;:!?])([A-Za-z])/g;

/**
 * Where a footnote sat between two *words* the weld leaves no punctuation to key on, so the
 * split point is not mechanically derivable and has to be stated. This is the complete list
 * for the WEB distribution in `data/raw/web.json`; `assertNoTextArtifacts` fails the ingest
 * if a build ever produces a welded pair that is not covered here, so this table cannot go
 * quietly out of date when the source is refreshed.
 *
 * Each entry was checked against the published World English Bible text.
 */
const WELDED_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bwindblows\b/g, "wind blows"], // John 3:8      — footnote on "wind" (Gk. pneuma)
  [/\bgenerationwill\b/g, "generation will"], // Matt 24:34, Mark 13:30
  [/\bwhenmen\b/g, "when men"], // Luke 6:26
  [/\bdisregardhis\b/g, "disregard his"], // Luke 14:26
  [/\bdrachmacoins\b/g, "drachma coins"], // Luke 15:8   — footnote on the coin's value
  [/\bthingsbecause\b/g, "things because"], // John 16:3
  [/\byourwoman\b/g, "your woman"], // Rev 2:20
];

export function normalizeVerseText(raw: string): string {
  let text = raw.normalize("NFC").replace(FOOTNOTE_RESIDUE, "");

  for (const [pattern, replacement] of WELDED_WORDS) {
    text = text.replace(pattern, replacement);
  }

  return text
    .replace(WELDED_PUNCTUATION, "$1$2 $3")
    .replace(/\s+/g, " ")
    .trim();
}

/** A single detected defect in normalized verse text. */
export interface TextArtifact {
  verseId: number;
  kind: "markup-residue" | "welded-punctuation" | "welded-words" | "empty";
  detail: string;
}

/**
 * Post-normalization validation gate.
 *
 * Runs over the text actually about to be written and re-detects every defect class the
 * repair stage above exists to remove. The point is that refreshing or re-sourcing the
 * corpus can only ever *fail loudly*: a new welded pair that `WELDED_WORDS` does not cover
 * stops the ingest instead of silently reaching the reader.
 *
 * `isKnownWord` is injected rather than hard-coded so the caller owns the dictionary; the
 * welded-word check only fires when both halves are real words and the concatenation is not,
 * which is what distinguishes "windblows" from legitimate compounds like "doorkeeper".
 */
export interface ArtifactScanOptions {
  /**
   * Run the LEXICAL welded-word heuristic (`windblows` -> `wind blows`).
   *
   * On by default, and it must stay on for every text whose source arrives with its markup
   * already stripped by somebody else — the getbible WEB JSON and the Berean plain-text file.
   * For those, a weld is undetectable structurally: the whitespace was destroyed upstream and
   * all that is left is a lexical trace, so a guess is the only check available.
   *
   * It is turned OFF only for sources parsed from publisher USFX by `usfx.ts`, and NOT because
   * it is noisy — because for those the same defect is checked DIRECTLY and more strongly.
   * `parseUsfx` records every site where deleting markup would have joined two word characters
   * and the ingest fails if that list is non-empty, which is a proof about the actual bytes
   * rather than an inference from a dictionary. Measured across all five USFX sources: zero
   * such sites.
   *
   * The distinction matters because these texts are 17th-to-19th-century English and the
   * heuristic does not know it: `knowest`, `wherewith`, `shouldest`, `peradventure`,
   * `beforetime` and about a thousand others split into two dictionary words and are flagged.
   * Whitelisting them would mean adding ~1,000 unreviewed entries to a table documented as
   * "every entry confirmed by eye", and — worse — those entries would then silence the check
   * for WEB and BSB too, which is the one place it is load-bearing. Narrowing the heuristic to
   * the sources it can actually reason about keeps it at full strength where it is the only
   * evidence, and replaces it with better evidence everywhere else.
   *
   * The other three checks — markup residue, welded punctuation, and empty text — run over
   * EVERY translation regardless. They cost nothing on the USFX sources (measured: zero hits)
   * and they are the checks that would catch a parser regression in this very file.
   */
  checkWeldedWords?: boolean;
}

export function findTextArtifacts(
  verses: ReadonlyArray<{ verseId: number; text: string }>,
  isKnownWord: (word: string) => boolean,
  options: ArtifactScanOptions = {},
): TextArtifact[] {
  const { checkWeldedWords = true } = options;
  const artifacts: TextArtifact[] = [];

  for (const { verseId, text } of verses) {
    if (text.trim().length === 0) {
      artifacts.push({ verseId, kind: "empty", detail: "verse text is empty" });
      continue;
    }

    const residue = text.match(/\/f\s*\+|\/f\*|\\[a-z]+\*?/g);
    if (residue) {
      artifacts.push({ verseId, kind: "markup-residue", detail: residue.join(" ") });
    }

    const welded = text.match(/\S*[a-z][.,;:!?][A-Za-z]\S*/g);
    if (welded) {
      artifacts.push({ verseId, kind: "welded-punctuation", detail: welded.join(" ") });
    }

    if (!checkWeldedWords) continue;

    for (const token of text.match(/[A-Za-z]+/g) ?? []) {
      // Proper nouns are skipped: a capitalized unknown token is a place or a person, not a
      // weld, and the corpus is full of them.
      if (!/^[a-z]/.test(token) || token.length < 7) continue;
      const lower = token.toLowerCase();
      if (isKnownWord(lower)) continue;
      for (let i = 3; i <= lower.length - 3; i++) {
        const head = lower.slice(0, i);
        const tail = lower.slice(i);
        if (isKnownWord(head) && isKnownWord(tail)) {
          artifacts.push({
            verseId,
            kind: "welded-words",
            detail: `${token} -> ${head} ${tail}`,
          });
          break;
        }
      }
    }
  }

  return artifacts;
}
