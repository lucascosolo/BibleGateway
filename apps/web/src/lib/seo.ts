import { bookOf, chapterOf, verseOf, toUrlSlug, type VerseRange, type BookIndex } from "@/lib/refs";
import type { Metadata } from "next";

export const SITE_URL = "https://bible.lucascosolo.com";

export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: "Jot", type: "website" },
    twitter: { card: "summary", title, description },
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
