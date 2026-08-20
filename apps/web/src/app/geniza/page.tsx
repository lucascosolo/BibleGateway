import { RoadmapPage } from "@/components/shell/RoadmapPage";

export const metadata = { title: "Geniza (not yet built) · Jot" };

export default function GenizaPage() {
  return (
    <RoadmapPage
      lexiconId="geniza"
      phase={3}
      phaseTitle="Linguistics & Textual Criticism"
      dataSources={[
        "A curated table of roughly 150 significant manuscripts (Sinaiticus, Vaticanus, Alexandrinus, the Great Isaiah Scroll, and others), hand-built from published scholarship",
        "INTF Liste / NT.VMR (Münster) for the authoritative Greek NT manuscript register",
        "CNTR transcriptions, CSNTM imagery (linked, not redistributed), and the Leon Levy Dead Sea Scrolls Digital Library",
        "Wikidata for structured coverage of the major codices",
      ]}
      today={{
        href: "/#doorways",
        label: "See the twelve verses a critical-text translation omits",
        description:
          "Not a manuscript catalog, but it is real textual-criticism data already in the corpus — the clearest evidence today that the text has a transmission history at all.",
      }}
    />
  );
}
