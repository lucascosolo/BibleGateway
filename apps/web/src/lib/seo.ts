import { bookOf, chapterOf, verseOf, toUrlSlug, type VerseRange, type BookIndex } from "@/lib/refs";
import type { Metadata } from "next";

export const SITE_URL = "https://bible.lucascosolo.com";
export const SITE_NAME = "Jot";

/**
 * What a shared link's preview card shows (`/og`).
 *
 * A card names WHAT to draw, never the text to draw: the route looks the words up itself. A card
 * URL that accepted arbitrary title/body text would let anyone mint a Jot-branded image saying
 * anything, hosted on this domain. The one exception is a search query, which is shown framed as
 * a query and truncated, because the card for a search link is only useful if it says what was
 * searched.
 */
export type ShareCard =
  | { kind: "page"; page: SharePage; query?: string }
  | { kind: "passage"; ref: string; t: string }
  | { kind: "parallel"; ref: string; a: string; b: string }
  | { kind: "network"; ref: string; t: string }
  | { kind: "word"; key: string };

export type SharePage =
  | "home"
  | "read"
  | "derash"
  | "lashon"
  | "api"
  | "roadmap"
  | "notes"
  | "geniza"
  | "massaot"
  | "toledot"
  | "style";

export const SHARE_PAGES: readonly SharePage[] = [
  "home", "read", "derash", "lashon", "api", "roadmap", "notes", "geniza", "massaot", "toledot", "style",
];

/** Twitter/Open Graph large-image size. Every card is drawn at exactly this. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/**
 * Bumped whenever the card DESIGN changes. Together with the corpus build id it forms the `v`
 * parameter, which is what lets `/og` claim `immutable`: the address names the exact version of
 * both inputs, so a changed card is a different URL (see the `immutable` trap in AGENTS.md).
 */
export const CARD_VERSION = "1";

export function cardVersion(buildId: string): string {
  return `${CARD_VERSION}.${buildId.slice(0, 12)}`;
}

/** The `/og` address for a card. Parameter order is fixed so equal cards share a cache entry. */
export function shareImagePath(card: ShareCard, version: string): string {
  const params = new URLSearchParams();
  params.set("kind", card.kind);
  switch (card.kind) {
    case "page":
      params.set("page", card.page);
      if (card.query) params.set("q", card.query);
      break;
    case "passage":
    case "network":
      params.set("ref", card.ref);
      params.set("t", card.t);
      break;
    case "parallel":
      params.set("ref", card.ref);
      params.set("a", card.a);
      params.set("b", card.b);
      break;
    case "word":
      params.set("key", card.key);
      break;
  }
  params.set("v", version);
  return `/og?${params.toString()}`;
}

/**
 * The page title without the ` · Jot` suffix the browser tab needs.
 *
 * Every unfurler (iMessage, Slack, Discord, X, LinkedIn) prints `og:site_name` beside the title
 * already, so the suffix would read "John 3:16 · Jot — Jot".
 */
export function shareTitle(title: string): string {
  return title.replace(/\s*·\s*Jot$/, "").trim();
}

/**
 * Cut text to at most `max` characters on a word boundary, ending with an ellipsis when cut.
 * Preview surfaces truncate on their own, mid-word and without warning; doing it here means the
 * reader always sees a whole word and an honest marker that more follows.
 */
export function excerpt(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const boundary = cut.lastIndexOf(" ");
  const head = (boundary > max * 0.6 ? cut.slice(0, boundary) : cut).replace(/[\s,;:.—–-]+$/, "");
  return `${head}…`;
}

interface PageMetadataOptions {
  /** The preview card. Defaults to the home card; every page gets one, never none. */
  card?: ShareCard;
  /** Corpus build id, from `getCorpusBuildId()`; versions the card URL. */
  buildId: string;
  /** Alt text for the card image. Defaults to the share title. */
  imageAlt?: string;
  /** `og:title` when it should differ from the tab title beyond dropping the suffix. */
  shareTitle?: string;
  /** `og:description` when the share text should differ from the search-result description. */
  shareDescription?: string;
}

/**
 * Title, description, canonical address and the full share-card set for one page.
 *
 * Always returns `openGraph` and `twitter` IN FULL. Next merges metadata shallowly, so a page
 * that sets `openGraph` at all replaces the layout's object wholesale — a page that passed only a
 * title here would silently lose `og:image` and unfurl as a bare link.
 */
export function pageMetadata(title: string, description: string, path: string, options: PageMetadataOptions): Metadata {
  const card = options.card ?? { kind: "page", page: "home" };
  const ogTitle = options.shareTitle ?? shareTitle(title);
  const ogDescription = options.shareDescription ?? description;
  const image = {
    url: shareImagePath(card, cardVersion(options.buildId)),
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alt: options.imageAlt ?? ogTitle,
    type: "image/png",
  };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: path,
      siteName: SITE_NAME,
      locale: "en_US",
      type: card.kind === "page" ? "website" : "article",
      images: [image],
    },
    twitter: { card: "summary_large_image", title: ogTitle, description: ogDescription, images: [image] },
  };
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]!);
}

export function xmlResponse(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}

/** Collapse the parser's open chapter/book bounds to the public browse URL. */
export function canonicalReferenceSlug(range: VerseRange, books: BookIndex): string {
  const book = books.get(bookOf(range.start) as number);
  if (book && bookOf(range.start) === bookOf(range.end) && verseOf(range.start) === 1 && verseOf(range.end) === 999) {
    if (chapterOf(range.start) === 1 && chapterOf(range.end) === 999) return book.osisId;
    if (chapterOf(range.start) === chapterOf(range.end)) return `${book.osisId}.${chapterOf(range.start)}`;
  }
  return toUrlSlug(range, books);
}
