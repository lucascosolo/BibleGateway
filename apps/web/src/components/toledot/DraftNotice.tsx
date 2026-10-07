/** Where a reader can see what review the content is still waiting on. */
const REVIEW_NOTES_URL = "https://github.com/lucascosolo/BibleGateway/tree/HEAD/packages/timeline#review-notes-for-the-seed-content";

/**
 * The draft disclosure. Caption voice, never the alert palette: it is information about the
 * state of the content, not a malfunction (AGENTS.md, "A capped view notice is information").
 */
export function DraftNotice({ scope = "this page" }: { scope?: string }) {
  return (
    <p className="toledot-draft">
      Draft — not yet reviewed against its sources. Everything on {scope} is cited, but no reviewer has checked
      the citations yet.{" "}
      <a href={REVIEW_NOTES_URL} rel="noopener noreferrer" target="_blank">
        Review notes
      </a>
    </p>
  );
}
