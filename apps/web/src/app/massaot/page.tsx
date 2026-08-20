import { RoadmapPage } from "@/components/shell/RoadmapPage";

export const metadata = { title: "Massa'ot (not yet built) · Jot" };

export default function MassaotPage() {
  return (
    <RoadmapPage
      lexiconId="massaot"
      phase={4}
      phaseTitle="Advanced Layers & Polish"
      dataSources={[
        "OpenBible.info Bible Geocoding — lat/long for biblical places, keyed to verses",
        "Pleiades — the ancient-world gazetteer, for stable place identifiers to link out to",
        "places and place_verse_mentions tables joining both into the reader",
      ]}
    />
  );
}
