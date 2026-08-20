import { describe, expect, it } from "vitest";

import { insertChapterHeadings, mergePassageItems, type PassageItem } from "./PassageRenderer";
import type { VerseText } from "@/lib/db/corpus";
import type { OmittedVerseNote } from "./OmittedVerse";
import type { VerseId } from "@/lib/refs/verse-id";

/**
 * An omission note placed at the wrong point in a passage misattributes a claim about the
 * manuscript tradition to the wrong verse — a worse failure than showing nothing. Hence the
 * boundary cases below are tested explicitly rather than assumed from the loop's shape.
 */

const verse = (verseId: number, verseNum: number): VerseText => ({
  verseId: verseId as VerseId,
  chapter: Math.floor(verseId / 1000) % 1000,
  verse: verseNum,
  text: `text ${verseNum}`,
  heatBucket: 0,
});

const omission = (verseId: number, verseNum: number): OmittedVerseNote => ({
  verseId,
  verse: verseNum,
  reason: "absent from the earliest manuscripts",
  history: "history",
  printedBy: [{ code: "WEB", name: "World English Bible" }],
});

/**
 * Compact readout: "20 [21] 22" — printed verse numbers, omissions in brackets, chapter
 * headings as "<c3>".
 */
const shape = (items: readonly PassageItem[]) =>
  items
    .map((item) => {
      if (item.kind === "verse") return `${item.verse.verse}`;
      if (item.kind === "omission") return `[${item.note.verse}]`;
      return `<c${item.chapter}>`;
    })
    .join(" ");

describe("mergePassageItems", () => {
  it("returns verses untouched when there are no omissions", () => {
    const verses = [verse(41009043, 43), verse(41009045, 45)];
    expect(shape(mergePassageItems(verses, undefined))).toBe("43 45");
    expect(shape(mergePassageItems(verses, []))).toBe("43 45");
  });

  it("places an omission in the gap it explains", () => {
    // Mark 9:44 is omitted by translations following the critical text; 43 and 45 are printed.
    const verses = [verse(41009043, 43), verse(41009045, 45)];
    expect(shape(mergePassageItems(verses, [omission(41009044, 44)]))).toBe("43 [44] 45");
  });

  it("handles several omissions in one passage", () => {
    // Mark 9 omits both 44 and 46.
    const verses = [verse(41009043, 43), verse(41009045, 45), verse(41009047, 47)];
    const notes = [omission(41009044, 44), omission(41009046, 46)];
    expect(shape(mergePassageItems(verses, notes))).toBe("43 [44] 45 [46] 47");
  });

  it("handles consecutive omissions between the same pair of verses", () => {
    const verses = [verse(41009043, 43), verse(41009047, 47)];
    const notes = [omission(41009044, 44), omission(41009046, 46)];
    expect(shape(mergePassageItems(verses, notes))).toBe("43 [44] [46] 47");
  });

  it("keeps an omission that precedes every printed verse", () => {
    const verses = [verse(41009045, 45)];
    expect(shape(mergePassageItems(verses, [omission(41009044, 44)]))).toBe("[44] 45");
  });

  it("keeps an omission that follows every printed verse", () => {
    // The trailing drain: a loop that only flushes omissions *before* a verse loses this one.
    const verses = [verse(45016023, 23)];
    expect(shape(mergePassageItems(verses, [omission(45016024, 24)]))).toBe("23 [24]");
  });

  it("keeps omissions when the passage has no printed verses at all", () => {
    expect(shape(mergePassageItems([], [omission(43005004, 4)]))).toBe("[4]");
  });

  it("preserves verse identity, not just ordering", () => {
    const items = mergePassageItems([verse(41009043, 43)], [omission(41009044, 44)]);
    expect(items[0]).toMatchObject({ kind: "verse", verse: { verseId: 41009043 } });
    expect(items[1]).toMatchObject({ kind: "omission", note: { verseId: 41009044 } });
  });
});

/**
 * A chapter heading in the wrong place attributes scripture to the wrong chapter, which is the
 * same class of failure as a misplaced omission note — so the boundaries are pinned rather
 * than trusted to the loop's shape.
 */
describe("insertChapterHeadings", () => {
  it("adds nothing to a single-chapter passage", () => {
    // The page heading already names the chapter; repeating it above verse 1 is noise.
    const items = mergePassageItems([verse(43003016, 16), verse(43003017, 17)], undefined);
    expect(shape(insertChapterHeadings(items))).toBe("16 17");
  });

  it("adds nothing to an empty stream", () => {
    expect(insertChapterHeadings([])).toEqual([]);
  });

  it("marks each boundary in a multi-chapter passage", () => {
    const items = mergePassageItems(
      [verse(43003035, 35), verse(43003036, 36), verse(43004001, 1), verse(43004002, 2)],
      undefined,
    );
    expect(shape(insertChapterHeadings(items))).toBe("<c3> 35 36 <c4> 1 2");
  });

  it("opens a chapter on an omission when the omission comes first", () => {
    // Mark 9:43 (printed) then 9:44 (omitted) is within one chapter, but a chapter whose
    // FIRST item is an omission still has to be labelled — otherwise the heading lands after
    // the apparatus note it introduces.
    const items = mergePassageItems([verse(41008038, 38), verse(41009045, 45)], [
      omission(41009044, 44),
    ]);
    expect(shape(insertChapterHeadings(items))).toBe("<c8> 38 <c9> [44] 45");
  });

  it("labels the heading with the chapter of the verses that follow it", () => {
    const items = insertChapterHeadings(
      mergePassageItems([verse(43003036, 36), verse(43004001, 1)], undefined),
    );
    expect(items[0]).toMatchObject({ kind: "chapter", bookId: 43, chapter: 3 });
    expect(items[2]).toMatchObject({ kind: "chapter", bookId: 43, chapter: 4 });
  });

  it("distinguishes chapter 3 of two different books", () => {
    // Chapter numbers restart per book, so keying on the chapter number alone would merge
    // Luke 3 into John 3 and emit a single heading for both.
    const items = mergePassageItems([verse(42003001, 1), verse(43003001, 1)], undefined);
    const headings = insertChapterHeadings(items).filter((i) => i.kind === "chapter");
    expect(headings).toHaveLength(2);
    expect(headings.map((h) => (h.kind === "chapter" ? h.bookId : 0))).toEqual([42, 43]);
  });
});
