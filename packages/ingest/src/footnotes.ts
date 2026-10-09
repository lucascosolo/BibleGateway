// Translator footnotes, read out of a verse's raw USFX before usfx.ts deletes the spans.
//
// They are apparatus, not scripture: they go to `verse_footnotes`, and `verse_texts` stays
// plain (highlight offsets depend on it — see AGENTS.md).

export type FootnoteKind = "footnote" | "endnote" | "crossref";

export interface Footnote {
  /** The publisher's caller: "+" (auto-numbered), "-" (no caller printed), or a literal mark. */
  caller: string;
  kind: FootnoteKind;
  /** The note's text with markup removed, whitespace collapsed, NFC-normalized. */
  text: string;
}

const KIND_BY_TAG: Readonly<Record<string, FootnoteKind>> = { f: "footnote", fe: "endnote", x: "crossref" };

const XML_ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " ",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, (m) => XML_ENTITIES[m])
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)));
}

/**
 * Every `f`, `fe` and `x` span in `verseXml`, in document order. Inner tags are removed with no
 * substitution, for the same reason usfx.ts gives: the source's whitespace already sits where
 * a word boundary is meant. A span whose text is empty is not a note and is dropped.
 */
export function parseFootnotes(verseXml: string): Footnote[] {
  const notes: Footnote[] = [];
  for (const m of verseXml.matchAll(/<(fe|f|x)\b([^>]*?)(?<!\/)>([\s\S]*?)<\/\1>/g)) {
    const text = decodeEntities(m[3].replace(/<[^>]*>/g, ""))
      .replace(/\s+/g, " ")
      .trim()
      .normalize("NFC");
    if (!text) continue;
    const caller = decodeEntities(m[2].match(/\bcaller="([^"]*)"/)?.[1] ?? "");
    notes.push({ caller, kind: KIND_BY_TAG[m[1]], text });
  }
  return notes;
}
