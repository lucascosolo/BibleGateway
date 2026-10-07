/** Where a reader can see what review the content is still waiting on. */
const REVIEW_NOTES_URL = "https://github.com/lucascosolo/BibleGateway/tree/HEAD/packages/timeline#review-notes-for-the-seed-content";

/**
 * The draft disclosure. Caption voice, never the alert palette: it is information about the
 * state of the content, not a malfunction (AGENTS.md, "A capped view notice is information").
 */
export function DraftNotice({ scope = "this page" }: { scope?: string }) {
  return (
    <p className="toledot-draft">
      Draft, not yet reviewed. Everything on {scope} cites a source, but no one has checked those sources yet.{" "}
      <a href={REVIEW_NOTES_URL} rel="noopener noreferrer" target="_blank">
        Review notes
      </a>
    </p>
  );
}
