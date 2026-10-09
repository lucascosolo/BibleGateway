import { shareMetadata } from "@/app/og/data";
import { GlossLabel } from "@/components/GlossLabel";
import { ThresholdAreas } from "@/components/chitzonim/ThresholdAreas";
import { OUTSIDE_AREAS } from "@/lib/chitzonim/outside";
import { getOutsideBooks } from "@/lib/db/outside";
import { getWorkSummaries } from "@/lib/db/timeline";

export const dynamic = "force-dynamic";

export const metadata = shareMetadata(
  "Chitzonim: the outside books · Jot",
  "Writings beside the Bible: the Septuagint's extra books, 1 Enoch and Jubilees, the Gospel of Thomas, the Apostolic Fathers. Read with the same apparatus as scripture, each with who holds it and when it was written.",
  "/chitzonim",
  { card: { kind: "page", page: "read" } },
);

export default function ChitzonimThreshold() {
  const books = getOutsideBooks();
  const described = getWorkSummaries().filter((w) => w.canon === "described").length;
  const areas = OUTSIDE_AREAS.map((area) =>
    area.key === "described"
      ? { ...area, count: described, unit: "work" as const }
      : { ...area, count: books.filter((b) => b.canon === area.key).length, unit: "book" as const },
  );

  return (
    <div className="outside-page">
      <header className="outside-page__header">
        <h1 className="outside-page__title">
          <GlossLabel id="chitzonim" />
        </h1>
        <p className="outside-page__lede">
          These are Jewish and early Christian writings that circulated beside the books of the Bible: some were
          read in synagogue or church for centuries, some were quoted by the New Testament, some were found again
          only in the last two hundred years in the sands of Egypt and the caves above the Dead Sea. They are not
          a hidden Bible and not a single collection; no one ever bound all of them together. Each is printed here
          in a public-domain translation with the same apparatus as scripture, and each says who reads it, when
          and where it was written, and what survives of it.
        </p>
      </header>

      <ThresholdAreas areas={areas} />

      <aside className="outside-page__canon-note" aria-label="Who reads which">
        <p>
          None of these books is in the Hebrew Bible or in Protestant Bibles. Who reads which:
        </p>
        <ul>
          {OUTSIDE_AREAS.map((area) => (
            <li key={area.key}>
              <strong>{area.title}.</strong> {area.readBy}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
