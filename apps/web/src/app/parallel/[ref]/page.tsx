import { canonicalReferenceSlug } from "@/lib/seo";
import { passageSnapshot, quoteLine, shareMetadata } from "@/app/og/data";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ParallelView, type ParallelTranslation } from "@/components/reader/ParallelView";
import {
  getExistingVerseIds,
  getOutsideBookIndex,
  getPassage,
  getTranslations,
} from "@/lib/db/corpus";
import { getOmissions, getTranslationsPrintingBook } from "@/lib/db/apparatus";
import { carryingTranslations, isOutsideBook, parallelPair } from "@/lib/chitzonim/outside";
import { InvalidReferenceError, bookOf, formatRange, parseReference, type ParsedReference } from "@/lib/refs";

interface ParallelPageProps {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}

/** The editions that print this passage's book, in corpus order; the 66 never list outside-only editions. */
function carryingFor(range: ParsedReference, outsideOnly: boolean) {
  const printing = getTranslationsPrintingBook(bookOf(range.start) as number, 0).map((t) => t.code);
  const all = getTranslations().filter((t) => outsideOnly || t.scope !== "outside");
  return carryingTranslations(all, printing);
}

export async function generateMetadata({ params, searchParams }: ParallelPageProps) {
  const books = getOutsideBookIndex();
  const query = await searchParams;
  let range;
  try {
    range = parseReference(decodeURIComponent((await params).ref), books);
  } catch { notFound(); }
  if (getExistingVerseIds(range).length === 0) notFound();
  const { left, right } = parallelPair(carryingFor(range, isOutsideBook(bookOf(range.start) as number)), query.a, query.b);
  if (!left) notFound();
  const label = formatRange(range, books);
  const slug = canonicalReferenceSlug(range, books);
  const snapshot = passageSnapshot(slug, left.code, 2);
  if (!right) {
    return shareMetadata(`${label} in ${left.name} · Jot`, `${label} in ${left.name}; the only English translation of this book on the site.`,
      `/parallel/${slug}?a=${left.code}`);
  }
  return shareMetadata(`${label}: ${left.code} and ${right.code} Bible comparison · Jot`,
    `Compare ${label} in ${left.name} and ${right.name}, aligned by canonical verse with notes for omitted verses.`,
    `/parallel/${slug}?a=${left.code}&b=${right.code}`,
    {
      card: { kind: "parallel", ref: slug, a: left.code, b: right.code },
      shareTitle: `${label}: ${left.code} and ${right.code} side by side`,
      shareDescription: snapshot
        ? `“${quoteLine(snapshot, 140)}” (${left.code}) — compared with the ${right.name}, verse by verse.`
        : undefined,
    });
}

export default async function ParallelPage({ params, searchParams }: ParallelPageProps) {
  const { ref } = await params;
  const query = await searchParams;
  const books = getOutsideBookIndex();
  let range;
  try {
    range = parseReference(decodeURIComponent(ref), books);
  } catch (error) {
    if (error instanceof InvalidReferenceError) notFound();
    throw error;
  }

  const verseIds = getExistingVerseIds(range);
  if (verseIds.length === 0) notFound();

  const carrying = carryingFor(range, isOutsideBook(bookOf(range.start) as number));
  const { left, right } = parallelPair(carrying, query.a, query.b);
  if (!left) notFound();

  const makeTranslation = (translation: typeof left): ParallelTranslation => ({
    code: translation.code,
    name: translation.name,
    translationId: translation.translationId,
    verses: getPassage(range, translation.translationId),
    omissions: getOmissions(range, translation.translationId),
  });

  if (right && left.translationId === right.translationId) {
    return (
      <div className="parallel-index">
        <h1>Choose two different translations</h1>
        <p>The comparison needs two editions. Pick another edition below.</p>
        <nav aria-label="Translations">
          {carrying.filter((t) => t.translationId !== left.translationId).map((t) => (
            <Link key={t.code} href={`/parallel/${canonicalReferenceSlug(range, books)}?a=${left.code}&b=${t.code}`}>
              {t.code} · {t.name}
            </Link>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <ParallelView
      reference={formatRange(range, books)}
      readerSlug={canonicalReferenceSlug(range, books)}
      translations={right ? [makeTranslation(left), makeTranslation(right)] : [makeTranslation(left)]}
      verseIds={verseIds}
      note={right ? undefined : "Only one English translation of this book is on the site, so there is nothing to set beside it."}
    />
  );
}
