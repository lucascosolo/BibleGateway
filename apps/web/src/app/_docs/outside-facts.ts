import "server-only";

import { getTranslations } from "@/lib/db/corpus";
import { getWorkSummaries } from "@/lib/db/timeline";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n: number): string => WORDS[n] ?? String(n);
const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export interface OutsideDocFacts {
  workCount: number;
  undatedCount: number;
  undatedTitles: string[];
  translationCodes: string[];
  /** "Eight" */
  undatedWord: string;
  /** "Seven" */
  translationWord: string;
}

/** Counts the API documents quote about the outside books, read from the data so they cannot drift. */
export function getOutsideDocFacts(): OutsideDocFacts {
  const works = getWorkSummaries();
  const undatedTitles = works.filter((w) => w.composedUndated !== null).map((w) => w.title);
  const translationCodes = getTranslations().filter((t) => t.scope === "outside").map((t) => t.code);
  return {
    workCount: works.length,
    undatedCount: undatedTitles.length,
    undatedTitles,
    translationCodes,
    undatedWord: capitalise(word(undatedTitles.length)),
    translationWord: capitalise(word(translationCodes.length)),
  };
}
