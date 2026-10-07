import { StructuredData } from "@/app/_components/StructuredData";
import type { ArtifactDetail, Citation, EventDetail, IssueDetail, PersonDetail } from "@/lib/db/timeline";
import { SITE_URL } from "@/lib/seo";
import { formatRange } from "@/lib/timeline/years";

type Subject =
  | { kind: "event"; event: EventDetail }
  | { kind: "person"; person: PersonDetail }
  | { kind: "artifact"; artifact: ArtifactDetail }
  | { kind: "issue"; issue: IssueDetail };

const cited = (citations: readonly Citation[]) =>
  citations.map((citation) => ({
    "@type": "CreativeWork",
    name: citation.title,
    ...(citation.author ? { author: citation.author } : {}),
    ...(citation.year ? { datePublished: String(citation.year) } : {}),
    ...(citation.url ? { url: citation.url } : {}),
  }));

const page = (path: string) => ({ "@type": "WebPage", "@id": `${SITE_URL}${path}`, url: `${SITE_URL}${path}` });

const yearProperty = (name: string, value: number) => ({ "@type": "PropertyValue", name, value });

/**
 * JSON-LD for a Toledot page. BCE years go in `temporalCoverage` as text and as integer
 * properties: `-0586`-style ISO dates are read inconsistently across consumers.
 */
export function ToledotStructuredData(subject: Subject) {
  const common = { "@context": "https://schema.org", isAccessibleForFree: true };
  switch (subject.kind) {
    case "event": {
      const { event } = subject;
      const path = `/toledot/events/${event.id}`;
      return (
        <StructuredData data={{
          ...common, "@type": "Event", name: event.title, description: event.summary, url: `${SITE_URL}${path}`,
          temporalCoverage: formatRange(event.earliest, event.latest),
          additionalProperty: [yearProperty("earliestYear", event.earliest), yearProperty("latestYear", event.latest), { "@type": "PropertyValue", name: "confidence", value: event.confidence }],
          subjectOf: page(path),
          citation: cited([...event.positions.flatMap((position) => position.citations)]),
        }} />
      );
    }
    case "person": {
      const { person } = subject;
      const path = `/toledot/people/${person.id}`;
      return (
        <StructuredData data={{
          ...common, "@type": "Person", name: person.name, description: person.summary, url: `${SITE_URL}${path}`,
          ...(person.alsoKnownAs.length ? { alternateName: person.alsoKnownAs } : {}),
          ...(person.lived ? { temporalCoverage: formatRange(person.lived.earliest, person.lived.latest) } : {}),
          subjectOf: page(path),
          citation: cited(person.citations),
        }} />
      );
    }
    case "artifact": {
      const { artifact } = subject;
      const path = `/toledot/artifacts/${artifact.id}`;
      return (
        <StructuredData data={{
          ...common, "@type": ["CreativeWork", "ArchiveComponent"], name: artifact.name, description: artifact.summary,
          url: `${SITE_URL}${path}`, inLanguage: artifact.language,
          ...(artifact.made ? { temporalCoverage: formatRange(artifact.made.earliest, artifact.made.latest) } : {}),
          ...(artifact.heldBy ? { holdingArchive: { "@type": "ArchiveOrganization", name: artifact.heldBy.institution } } : {}),
          ...(artifact.heldBy?.accession ? { identifier: artifact.heldBy.accession } : {}),
          subjectOf: page(path),
          citation: cited(artifact.citations),
        }} />
      );
    }
    case "issue": {
      const { issue } = subject;
      const path = `/toledot/issues/${issue.id}`;
      return (
        <StructuredData data={{
          ...common, "@type": "Article", headline: issue.title, description: issue.summary, url: `${SITE_URL}${path}`,
          mainEntityOfPage: page(path),
          citation: cited([...issue.citations, ...issue.views.flatMap((view) => view.citations)]),
        }} />
      );
    }
  }
}
