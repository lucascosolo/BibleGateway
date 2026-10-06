import { pageMetadata, canonicalReferenceSlug } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ParallelView, type ParallelTranslation } from "@/components/reader/ParallelView";
import { getOmissions } from "@/lib/db/apparatus";
import {
  getBookIndex,
  getExistingVerseIds,
  getPassage,
  getTranslationByCode,
  getTranslations,
} from "@/lib/db/corpus";
import { InvalidReferenceError, formatRange, parseReference } from "@/lib/refs";

interface ParallelPageProps {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}

export async function generateMetadata({ params, searchParams }: ParallelPageProps) {
  const books = getBookIndex();
  const query = await searchParams;
  const left = readTranslation(query.a, "WEB");
  const right = readTranslation(query.b, left.code === "BSB" ? "WEB" : "BSB");
  let range;
  try {
    range = parseReference(decodeURIComponent((await params).ref), books);
  } catch { notFound(); }
  if (getExistingVerseIds(range).length === 0) notFound();
  const label = formatRange(range, books);
  return pageMetadata(`${label}: ${left.code} and ${right.code} Bible comparison · Jot`,
    `Compare ${label} in ${left.name} and ${right.name}, aligned by canonical verse with notes for omitted verses.`,
    `/parallel/${canonicalReferenceSlug(range, books)}?a=${left.code}&b=${right.code}`);
}

function readTranslation(code: string | undefined, fallback: string) {
  const translation = getTranslationByCode(code ?? fallback);
  if (!translation) notFound();
  return translation;
}

export default async function ParallelPage({ params, searchParams }: ParallelPageProps) {
  const { ref } = await params;
  const query = await searchParams;
  const books = getBookIndex();
  let range;
  try {
    range = parseReference(decodeURIComponent(ref), books);
  } catch (error) {
    if (error instanceof InvalidReferenceError) notFound();
    throw error;
  }

  const verseIds = getExistingVerseIds(range);
  if (verseIds.length === 0) notFound();

  const translations = getTranslations();
  const left = readTranslation(query.a, "WEB");
  const right = readTranslation(query.b, left.code === "BSB" ? "WEB" : "BSB");
  const selected: [typeof left, typeof right] = [left, right];

  if (left.translationId === right.translationId) {
    return (
      <div className="parallel-index">
        <h1>Choose two different translations</h1>
        <p>The comparison needs two editions. Pick another edition below.</p>
        <nav aria-label="Translations">
          {translations.filter((t) => t.translationId !== left.translationId).map((t) => (
            <Link key={t.code} href={`/parallel/${canonicalReferenceSlug(range, books)}?a=${left.code}&b=${t.code}`}>
              {t.code} · {t.name}
            </Link>
          ))}
        </nav>
      </div>
    );
  }

  const makeTranslation = (translation: typeof left): ParallelTranslation => ({
    code: translation.code,
    name: translation.name,
    translationId: translation.translationId,
    verses: getPassage(range, translation.translationId),
    omissions: getOmissions(range, translation.translationId),
  });

  return (
    <ParallelView
      reference={formatRange(range, books)}
      readerSlug={canonicalReferenceSlug(range, books)}
      translations={[makeTranslation(selected[0]), makeTranslation(selected[1])]}
      verseIds={verseIds}
    />
  );
}
