import "server-only";

import { getCorpusBuildId, getCorpus } from "@/lib/db/client";
import {
  countUniqueReferences,
  getBookIndex,
  getExistingVerseIds,
  getPassageOpening,
  getTranslationByCode,
  getTranslations,
  type Translation,
} from "@/lib/db/corpus";
import { getConcordanceSummary, resolveConcordanceKey } from "@/lib/db/originals";
import { getLexiconEntry, type LexiconId } from "@/lib/lexicon";
import { formatRange, parseReference, type VerseRange } from "@/lib/refs";
import { SHARE_PAGES, excerpt, pageMetadata, type ShareCard, type SharePage } from "@/lib/seo";

/**
 * Everything a share card or a link preview says, resolved from the corpus.
 *
 * Shared by `/og` (the image) and the pages' `generateMetadata` (the text beside it), so the
 * picture and the caption an unfurler prints under it can never describe two different things.
 */

/** Page metadata with the card URL versioned by the live corpus build. */
export function shareMetadata(
  title: string,
  description: string,
  path: string,
  options: Omit<Parameters<typeof pageMetadata>[3], "buildId"> = {}
) {
  return pageMetadata(title, description, path, { ...options, buildId: getCorpusBuildId() });
}

export interface PassageSnapshot {
  range: VerseRange;
  label: string;
  translation: Translation;
  verses: { verse: number; chapter: number; text: string }[];
  /** The reference spans more than one verse, so the card numbers its verses. */
  multiVerse: boolean;
}

/** Short licence line for a card footer: the part before any parenthetical. */
export function licenceLine(translation: Translation): string {
  return translation.license.replace(/\s*\(.*$/, "").trim();
}

export function resolveRange(ref: string): { range: VerseRange; label: string } | null {
  const books = getBookIndex();
  try {
    const range = parseReference(ref, books);
    if (getExistingVerseIds(range).length === 0) return null;
    return { range, label: formatRange(range, books) };
  } catch {
    return null;
  }
}

/** The opening verses of a reference in one translation; null when nothing is printed there. */
export function passageSnapshot(ref: string, code: string, limit = 4): PassageSnapshot | null {
  const resolved = resolveRange(ref);
  const translation = getTranslationByCode(code);
  if (!resolved || !translation) return null;
  const verses = getPassageOpening(resolved.range, translation.translationId, limit);
  if (verses.length === 0) return null;
  return { ...resolved, translation, verses, multiVerse: resolved.range.start !== resolved.range.end };
}

/** The passage as one quotable line, for `og:description`. */
export function quoteLine(snapshot: PassageSnapshot, max: number): string {
  return excerpt(snapshot.verses.map((v) => v.text).join(" "), max);
}

export interface WordSnapshot {
  headword: string;
  xlit: string | null;
  gloss: string | null;
  strongs: string | null;
  language: string;
  total: number;
  bookCount: number;
}

export function wordSnapshot(key: string): WordSnapshot | null {
  const summary = getConcordanceSummary(key);
  if (!summary) return null;
  return {
    headword: summary.lexicon?.headword ?? summary.greekLexicon?.headword ?? summary.lemma,
    xlit: summary.lexicon?.xlit || null,
    gloss: summary.lexicon?.gloss || summary.greekLexicon?.gloss || null,
    strongs: summary.strongs,
    language: summary.language,
    total: summary.total,
    bookCount: summary.books.length,
  };
}

export function familySnapshot(key: string): { base: string; members: number } | null {
  const resolution = resolveConcordanceKey(key);
  return resolution.kind === "family" ? { base: resolution.base, members: resolution.members.length } : null;
}

export function crossReferenceCount(range: VerseRange): number {
  return countUniqueReferences(range, -1_000_000);
}

export interface CorpusFacts {
  translations: number;
  crossReferences: number;
  books: number;
}

let facts: CorpusFacts | null = null;
/** Live corpus counts for the site-level cards; cached per process, as the corpus is immutable. */
export function corpusFacts(): CorpusFacts {
  if (facts) return facts;
  const db = getCorpus();
  facts = {
    translations: getTranslations().length,
    crossReferences: (db.prepare("SELECT COUNT(*) AS n FROM cross_references").get() as { n: number }).n,
    books: getBookIndex().all.length,
  };
  return facts;
}

export interface PageCardCopy {
  /** The small capitals line above the title. Terms always travel with their plain gloss. */
  kicker: string;
  title: string;
  body: string;
}

function plainGloss(id: LexiconId): string {
  const entry = getLexiconEntry(id);
  return entry.plainGloss ?? entry.gloss;
}

function term(id: LexiconId): string {
  const entry = getLexiconEntry(id);
  return `${entry.term} · ${entry.plainLabel}`;
}

export function pageCardCopy(page: SharePage, query?: string): PageCardCopy {
  const f = corpusFacts();
  const n = (value: number) => value.toLocaleString("en-US");
  switch (page) {
    case "home":
      return {
        kicker: "Scholarly Bible study",
        title: "Read the Bible closely",
        body: `Compare ${f.translations} translations without losing your place, follow ${n(f.crossReferences)} cross-references, and look up the Hebrew and Greek behind any word.`,
      };
    case "read":
      return {
        kicker: "The Bible",
        title: "Every book, chapter and verse",
        body: `${f.books} books in ${f.translations} public-domain translations, addressed by canonical verse so switching translation never loses your place.`,
      };
    case "derash":
      return query
        ? { kicker: term("derash"), title: `“${excerpt(query, 60)}”`, body: `Where this appears across ${f.translations} Bible translations, verse by verse and book by book.` }
        : { kicker: term("derash"), title: "Search the Bible", body: plainGloss("derash") };
    case "lashon":
      return { kicker: term("lashon"), title: "Hebrew, Aramaic & Greek", body: "Look up any word beneath the translation: Strong’s numbers, morphology, attributed dictionary entries and every occurrence." };
    case "api":
      return { kicker: "Research API", title: "A public, read-only Bible API", body: "Translation text, cross-references, original-language words and manuscript evidence, as JSON, with sources attached." };
    case "roadmap":
      return { kicker: "Roadmap", title: "What Jot covers, and what is next", body: "The research tools and datasets that exist today, and the ones still planned." };
    case "notes":
      return { kicker: "Notes & highlights", title: "Your study notes", body: "Highlights and notes kept on your own device, exportable whenever you want them." };
    case "toledot":
      return { kicker: term("toledot"), title: "Dated as ranges, with the arguments", body: "When the events happened, when the texts were written, and when they became scripture, each with the scholarly positions and the outside evidence behind it." };
    case "geniza":
    case "massaot": {
      const entry = getLexiconEntry(page);
      return { kicker: `${term(page)} · Planned`, title: entry.plainLabel, body: plainGloss(page) };
    }
    case "style":
      return { kicker: "Design", title: "Style reference", body: "The typography, colour and components Jot is built from." };
  }
}

/** Validates an incoming `/og` query into a card. Unknown input yields null, never a guess. */
export function parseCard(params: URLSearchParams): ShareCard | null {
  const get = (name: string) => params.get(name)?.slice(0, 200) ?? "";
  switch (get("kind")) {
    case "page": {
      const page = get("page") as SharePage;
      return isSharePage(page) ? { kind: "page", page, query: get("q") || undefined } : null;
    }
    case "passage":
    case "network":
      return get("ref") ? { kind: get("kind") as "passage" | "network", ref: get("ref"), t: get("t") || "WEB" } : null;
    case "parallel":
      return get("ref") ? { kind: "parallel", ref: get("ref"), a: get("a") || "WEB", b: get("b") || "BSB" } : null;
    case "word":
      return get("key") ? { kind: "word", key: get("key") } : null;
    default:
      return null;
  }
}

function isSharePage(value: string): value is SharePage {
  return (SHARE_PAGES as readonly string[]).includes(value);
}
