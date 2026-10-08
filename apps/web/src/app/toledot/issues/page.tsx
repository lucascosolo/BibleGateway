import Link from "next/link";

import { shareMetadata } from "@/app/og/data";
import { CatalogueIndex, type CatalogueItem } from "@/components/toledot/CatalogueIndex";
import { ISSUE_KIND } from "@/components/toledot/Lists";
import { getBookNames, getEras, getIssueSummaries, getTimelineBuildId, listIssueIds } from "@/lib/db/timeline";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  const metadata = shareMetadata(
    "Open questions about the Bible's history · Toledot · Jot",
    "The questions scholars still argue about, each with the competing views and the reasons behind them.",
    "/toledot/issues",
    { card: { kind: "page", page: "toledot" } },
  );
  return getTimelineBuildId() === null ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default function IssuesIndexPage() {
  const issues = getIssueSummaries(listIssueIds());
  const items: CatalogueItem[] = issues.map((issue) => ({
    id: issue.id,
    href: `/toledot/issues/${issue.id}`,
    title: issue.title,
    when: null,
    year: issue.firstYear,
    book: issue.firstVerse === null ? null : Math.floor(issue.firstVerse / 1_000_000),
    gist: issue.gist,
    searchText: [issue.title, issue.gist, ISSUE_KIND[issue.kind]].join(" "),
    facets: { kind: issue.kind },
    marks: [{ text: `${ISSUE_KIND[issue.kind]} question`, tone: "kind" }],
  }));

  return (
    <div className="toledot-catalogue">
      <nav aria-label="Breadcrumb" className="toledot-entity__crumb">
        <Link href="/toledot">← Timeline</Link>
      </nav>
      <h1 className="toledot-home__title">Open questions</h1>
      <p className="toledot-home__lede">
        Things scholars still disagree about, such as when a book was written or what an event meant, with each side laid out.
      </p>
      <CatalogueIndex
        kind="issues"
        eras={getEras().map(({ id, name, start, end }) => ({ id, name, start, end }))}
        books={[...getBookNames()]}
        items={items}
        countNoun="questions"
        chips={[
          {
            key: "kind",
            label: "Kind of question",
            values: Object.entries(ISSUE_KIND).map(([value, label]) => ({ value, label })),
          },
        ]}
      />
    </div>
  );
}
