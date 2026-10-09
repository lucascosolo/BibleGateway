import "server-only";

import { cache } from "react";

import type { BookRecord } from "@/lib/refs/book-index";
import { prepared } from "./client";

export interface OutsideBook {
  bookId: number;
  osisId: string;
  name: string;
  canon: NonNullable<BookRecord["canon"]>;
  numbering: NonNullable<BookRecord["numbering"]>;
  verses: number;
  /** Codes of the translations that print it, in corpus order. */
  translations: string[];
}

/** Books 67 and up with their size and the translations that carry them, in book order. */
export const getOutsideBooks = cache((): OutsideBook[] => {
  const rows = prepared(
    `SELECT b.book_id AS bookId, b.osis_id AS osisId, b.name, b.canon, b.numbering,
            (SELECT COUNT(*) FROM verses v WHERE v.book_id = b.book_id) AS verses,
            (SELECT json_group_array(code) FROM (
               SELECT t.code FROM translation_books tb JOIN translations t USING(translation_id)
               WHERE tb.book_id = b.book_id AND tb.status = 'printed' AND t.is_licensed = 1
               ORDER BY t.translation_id)) AS codes
     FROM books b WHERE b.canon NOT IN ('hebrew','nt') ORDER BY b.book_id`
  ).all() as (Omit<OutsideBook, "translations"> & { codes: string })[];
  return rows.map(({ codes, ...row }) => ({ ...row, translations: JSON.parse(codes) as string[] }));
});

export function getOutsideBook(bookId: number): OutsideBook | undefined {
  return getOutsideBooks().find((b) => b.bookId === bookId);
}

/** The lowest chapter a book prints: not always 1 (the Gospel of Mary's pages begin at 7). */
export function getFirstChapter(bookId: number): number | null {
  const row = prepared(`SELECT MIN(chapter) AS c FROM verses WHERE book_id = ?`).get(bookId) as { c: number | null };
  return row.c;
}
