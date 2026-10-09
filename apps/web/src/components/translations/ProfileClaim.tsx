import Link from "next/link";

import type { Citation, Claim } from "@/lib/translations/profiles";

const ON_SITE = /^(.*) \((\/read\/[^)]+)\)$/;

function CitationItem({ c }: { c: Citation }) {
  const onSite = ON_SITE.exec(c.locator);
  return (
    <li>
      {c.url ? (
        <a href={c.url} target="_blank" rel="noopener noreferrer">{c.source}</a>
      ) : (
        c.source
      )}
      {", "}
      {onSite ? <Link href={onSite[2]}>{onSite[1]}</Link> : c.locator}
      {c.publisherOnly && <span className="translations-claim__publisher"> (publisher&rsquo;s own statement only)</span>}
    </li>
  );
}

/** One claim and the sources it rests on, so every sentence on a profile can be checked. */
export function ProfileClaim({ claim }: { claim: Claim }) {
  return (
    <div className="translations-claim">
      <p>{claim.text}</p>
      <ol className="translations-claim__sources" aria-label="Sources">
        {claim.citations.map((c, i) => (
          <CitationItem key={i} c={c} />
        ))}
      </ol>
    </div>
  );
}
