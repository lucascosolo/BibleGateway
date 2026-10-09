/** One quiet line under an outside book's title: who reads it, and how the book is numbered. */
export function CanonNotice({ notice, numbering }: { notice: string | null; numbering?: string | null }) {
  if (!notice) return null;
  return (
    <p role="note" className="canon-notice">
      <span>{notice}</span>
      {numbering && <span className="canon-notice__numbering">Shown: {numbering}.</span>}
    </p>
  );
}
