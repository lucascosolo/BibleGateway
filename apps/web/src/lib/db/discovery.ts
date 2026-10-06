import "server-only";
import { prepared } from "./client";

/** Only actual printed or recorded-omission rows, including a partial edition's real scope. */
export function getEditionDiscoveryRows(translationId: number) {
  return prepared(`
    SELECT v.osis_ref AS reference, b.osis_id AS book, v.chapter
    FROM verses v JOIN books b ON b.book_id = v.book_id
    JOIN (
      SELECT verse_id FROM verse_texts WHERE translation_id = ?
      UNION SELECT verse_id FROM verse_omissions WHERE translation_id = ?
    ) available ON available.verse_id = v.verse_id
    ORDER BY v.verse_id
  `).all(translationId, translationId) as { reference: string; book: string; chapter: number }[];
}

export function getConcordanceDiscoveryKeys(): string[] {
  return (prepared(`SELECT DISTINCT COALESCE(strongs, lemma) AS key
    FROM original_words WHERE COALESCE(strongs, lemma) IS NOT NULL
    AND COALESCE(strongs, lemma) != '' ORDER BY key`).all() as { key: string }[]).map((row) => row.key);
}

/** Metadata needs availability, never an entire book's text. */
export function hasEditionContent(start: number, end: number, translationId: number): boolean {
  return Boolean(prepared(`SELECT 1 FROM verse_texts WHERE translation_id = ? AND verse_id BETWEEN ? AND ?
    UNION ALL SELECT 1 FROM verse_omissions WHERE translation_id = ? AND verse_id BETWEEN ? AND ? LIMIT 1`
  ).get(translationId, start, end, translationId, start, end));
}

export function getCanonicalDiscoveryRows() {
  return prepared(`SELECT v.osis_ref AS reference, b.osis_id AS book, v.chapter
    FROM verses v JOIN books b ON b.book_id = v.book_id ORDER BY v.verse_id`
  ).all() as { reference: string; book: string; chapter: number }[];
}
