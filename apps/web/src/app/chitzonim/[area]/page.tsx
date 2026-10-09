import Link from "next/link";
import { notFound } from "next/navigation";

import { shareMetadata } from "@/app/og/data";
import { getArea, OUTSIDE_AREAS } from "@/lib/chitzonim/outside";
import { getOutsideBooks, type OutsideBook } from "@/lib/db/outside";
import { getWorkSummaries, type WorkSummary } from "@/lib/db/timeline";
import { formatRange } from "@/lib/timeline/years";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ area: string }>;
}

export async function generateMetadata({ params }: Props) {
  const area = getArea((await params).area);
  if (!area) notFound();
  return shareMetadata(`${area.title} · Outside books · Jot`, area.summary, `/chitzonim/${area.key}`, {
    card: { kind: "page", page: "read" },
  });
}

interface Card {
  key: string;
  title: string;
  href: string;
  dates: string | null;
  translations: string[];
  verses: number;
  unit: string;
}

const UNIT: Record<string, string> = {
  logion: "sayings",
  section: "sections",
  chapter: "chapters",
  "part-chapter": "chapters",
  paragraph: "paragraphs",
  page: "passages",
};
const unitFor = (b: OutsideBook | undefined) => UNIT[b?.numbering ?? ""] ?? "verses";

/** One card per work where a record exists (the Testaments are one work in twelve books), else per book. */
function cards(books: OutsideBook[], works: WorkSummary[]): Card[] {
  const claimed = new Set<number>();
  const out: Card[] = works.map((work) => {
    const own = books.filter((b) => work.bookIds.includes(b.bookId));
    own.forEach((b) => claimed.add(b.bookId));
    return {
      key: work.id,
      title: work.title,
      href: `/chitzonim/works/${work.id}`,
      dates: formatRange(work.composedEarliest, work.composedLatest),
      translations: [...new Set(own.flatMap((b) => b.translations))],
      verses: own.reduce((n, b) => n + b.verses, 0),
      unit: unitFor(own[0]),
    };
  });
  for (const book of books) {
    if (claimed.has(book.bookId)) continue;
    out.push({
      key: book.osisId,
      title: book.name,
      href: `/read/${book.osisId}.1?t=${book.translations[0] ?? ""}`,
      dates: null,
      translations: book.translations,
      verses: book.verses,
      unit: unitFor(book),
    });
  }
  return out;
}

export default async function AreaPage({ params }: Props) {
  const area = getArea((await params).area);
  if (!area) notFound();
  const books = getOutsideBooks().filter((b) => b.canon === area.key);
  const works = getWorkSummaries().filter((w) => w.canon === area.key);
  const list = cards(books, works);

  return (
    <div className="outside-page">
      <nav aria-label="Breadcrumb" className="outside-page__crumb">
        <Link href="/chitzonim">Outside books</Link>
      </nav>
      <header className="outside-page__header">
        <h1 className="outside-page__title">{area.title}</h1>
        <p className="outside-page__lede">{area.summary}</p>
        <p className="outside-page__readby">{area.readBy}</p>
      </header>

      {list.length === 0 ? (
        <p className="outside-page__empty">
          The work pages for this area are being written; each will describe the work, where it was found and how it
          is dated, with short cited excerpts.
        </p>
      ) : (
        <ul className="outside-cards">
          {list.map((card) => (
            <li key={card.key} className="outside-card">
              <Link href={card.href} className="outside-card__link">
                <span className="outside-card__title">{card.title}</span>
              </Link>
              <dl className="outside-card__facts">
                {card.dates && (
                  <div>
                    <dt>Written</dt>
                    <dd>{card.dates}</dd>
                  </div>
                )}
                {card.translations.length > 0 && (
                  <div>
                    <dt>Translation</dt>
                    <dd>{card.translations.join(", ")}</dd>
                  </div>
                )}
                {card.verses > 0 && (
                  <div>
                    <dt>Length</dt>
                    <dd>{card.verses.toLocaleString("en-US")} {card.unit}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Other areas" className="outside-page__areas">
        {OUTSIDE_AREAS.filter((a) => a.key !== area.key).map((a) => (
          <Link key={a.key} href={`/chitzonim/${a.key}`}>
            {a.title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
