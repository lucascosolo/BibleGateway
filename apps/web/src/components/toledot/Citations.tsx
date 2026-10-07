import type { Citation } from "@/lib/db/timeline";

/** The sources under a claim: title (linked when the source is online), author, container, year, locator. */
export function Citations({ citations }: { citations: readonly Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <ol className="toledot-cites" aria-label="Sources">
      {citations.map((citation, index) => (
        <li key={`${citation.sourceId}-${index}`}>
          {citation.author ? <>{citation.author}, </> : null}
          <cite>
            {citation.url ? (
              <a href={citation.url} rel="noopener noreferrer" target="_blank">
                {citation.title}
              </a>
            ) : (
              citation.title
            )}
          </cite>
          {citation.container ? <>, in <i>{citation.container}</i></> : null}
          {citation.year ? <> ({citation.year})</> : null}
          {citation.locator ? <>, {citation.locator}</> : null}
        </li>
      ))}
    </ol>
  );
}
