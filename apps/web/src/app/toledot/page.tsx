import { shareMetadata } from "@/app/og/data";
import { RoadmapPage } from "@/components/shell/RoadmapPage";

export const metadata = {
  ...shareMetadata("Toledot (not yet built) · Jot", "When each book of the Bible was written, and when its events happened. Planned, not yet built.", "/toledot", { card: { kind: "page", page: "toledot" } }),
  robots: { index: false, follow: true },
};

export default function ToledotPage() {
  return (
    <RoadmapPage
      lexiconId="toledot"
      phase={2}
      phaseTitle="Cross-references & the Timeline"
      dataSources={[
        "book_datings — composition-date ranges per book, each tied to a named scholarly tradition and citation (never a bare scalar year)",
        "historical_events and eras — the narrative and world-history tracks",
        "OpenBible.info and Wikidata/Chronicon for the non-biblical historical spine",
      ]}
      today={{
        href: "/#browse",
        label: "Browse the canon by testament and genre",
        description:
          "Not a timeline — no dates are ingested yet — but it is the nearest ordering the app can offer honestly today.",
      }}
    />
  );
}
