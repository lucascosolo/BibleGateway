import { notFound } from "next/navigation";

import { shareMetadata } from "@/app/og/data";
import { Investigation } from "@/components/toledot/Investigation";
import { getOmissions } from "@/lib/db/apparatus";
import { getBookIndex, getPassage, getTranslations } from "@/lib/db/corpus";
import { getInvestigation } from "@/lib/db/timeline";
import { formatRange } from "@/lib/refs";
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

export default async function InvestigationPage({ params }: Props) {
  const investigation = getInvestigation((await params).id);
  if (!investigation) notFound();
  const range = { start: investigation.start, end: investigation.end };
  const { translationId } = getTranslations()[0];
  const omissions = [...getOmissions(range, translationId).values()].map((o) => ({
    verseId: o.verseId as number,
    verse: o.verse,
    reason: o.reason,
    history: o.history,
    kind: o.kind,
    printedBy: o.printedBy.map(({ code, name }) => ({ code, name })),
  }));

  return (
    <Investigation
      investigation={investigation}
      passage={{
        label: formatRange(range, getBookIndex()),
        verses: getPassage(range, translationId),
        range,
        translationId,
        omissions,
      }}
    />
  );
}
