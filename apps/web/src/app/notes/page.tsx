import Link from "next/link";

import { NotesIndex } from "@/components/notes/NotesIndex";
import { getExistingUserId } from "@/lib/annotations/auth";
import { getTranslations, getBookIndex } from "@/lib/db/corpus";
import { getAllAnnotations } from "@/lib/db/userdata";
import { formatRange, toUrlSlug } from "@/lib/refs";

export const metadata = {
  title: "Notes & highlights · Jot",
  description: "Review and export your Jot research notes and highlights.",
};

export default async function NotesPage() {
  const userId = await getExistingUserId();
  const books = getBookIndex();
  const translations = new Map(getTranslations().map((t) => [t.translationId, t.code]));
  const records = userId ? getAllAnnotations(userId).map((annotation) => {
    const range = { start: annotation.startVerseId, end: annotation.endVerseId };
    return {
      annotation,
      reference: formatRange(range, books),
      slug: toUrlSlug(range, books),
      translationCode: translations.get(annotation.translationId) ?? "WEB",
    };
  }) : [];

  return (
    <>
      <NotesIndex records={records} />
      <p className="notes-index__footnote">
        Notes stay in your private browser account. Verse addresses are canonical and do not
        change when you switch translations. <Link href="/read">Return to the reader.</Link>
      </p>
    </>
  );
}
