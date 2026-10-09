import { notFound } from "next/navigation";

import { shareMetadata } from "@/app/og/data";
import { Investigation } from "@/components/toledot/Investigation";
import type { InvestigationEdition } from "@/components/toledot/InvestigationEditions";
import { getBookScope, getFootnotes, getOmissions } from "@/lib/db/apparatus";
import { getBookIndex, getPassage, getTranslations } from "@/lib/db/corpus";
import { getGreekManuscriptReadings, getInterlinear, type OriginalWord } from "@/lib/db/originals";
import { getInvestigation } from "@/lib/db/timeline";
import { formatRange } from "@/lib/refs";
import { bookOf, type VerseId, type VerseRange } from "@/lib/refs/verse-id";
import { excerpt } from "@/lib/seo";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const investigation = getInvestigation((await params).id);
  if (!investigation) notFound();
  return shareMetadata(
    `${investigation.title} · Toledot · Jot`,
    excerpt(`${investigation.witnessCount} witnesses, ${investigation.differenceCount} explanations, each with its sources. ${investigation.summary}`, 200),
    `/toledot/investigations/${investigation.id}`,
    { card: { kind: "page", page: "toledot" } },
  );
}

function omissionNotes(range: VerseRange, translationId: number) {
  return [...getOmissions(range, translationId).values()].map((o) => ({
    verseId: o.verseId as number,
    verse: o.verse,
    reason: o.reason,
    history: o.history,
    kind: o.kind,
    printedBy: o.printedBy.map(({ code, name }) => ({ code, name })),
  }));
}

export default async function InvestigationPage({ params }: Props) {
  const investigation = getInvestigation((await params).id);
  if (!investigation) notFound();
  const range = { start: investigation.start, end: investigation.end };
  const translations = getTranslations();
  const { translationId } = translations[0];

  // Both endpoints, as in the reader: a range reaching into an excluded book still prints its other half.
  const editions: InvestigationEdition[] = translations.map((t) => {
    const outOfScope = [bookOf(range.start), bookOf(range.end)].every((b) => getBookScope(b, t.translationId) === "out_of_scope");
    const verses = outOfScope ? [] : getPassage(range, t.translationId);
    return {
      translationId: t.translationId,
      code: t.code,
      name: t.name,
      copyrightNotice: t.copyrightNotice,
      verses,
      omissions: outOfScope ? [] : omissionNotes(range, t.translationId),
      footnotes: getFootnotes(verses.map((v) => v.verseId), t.translationId),
      scopeNote: outOfScope ? t.scopeNote || `${t.name} does not include this book.` : undefined,
    };
  });

  const originals = new Map<VerseId, OriginalWord[]>();
  for (const word of getInterlinear(range)) {
    const list = originals.get(word.verseId);
    if (list) list.push(word);
    else originals.set(word.verseId, [word]);
  }

  return (
    <Investigation
      investigation={investigation}
      passage={{
        label: formatRange(range, getBookIndex()),
        verses: editions[0].verses,
        range,
        translationId,
        omissions: editions[0].omissions,
      }}
      editions={editions}
      originals={originals}
      manuscriptReadings={getGreekManuscriptReadings(range)}
    />
  );
}
