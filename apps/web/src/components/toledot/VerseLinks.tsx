import Link from "next/link";

/**
 * Passages as reader links. Takes rows already labelled by `labelVerses` on the server: this
 * component never sees, and never renders, verse text — the reader is the one renderer.
 */
export function VerseLinks({ verses }: { verses: readonly { label: string; path: string; note: string | null; start: number; end: number }[] }) {
  if (verses.length === 0) return null;
  return (
    <ul className="toledot-verses" aria-label="Passages">
      {verses.map((verse) => (
        <li key={`${verse.start}-${verse.end}-${verse.note ?? ""}`}>
          <Link prefetch={false} href={verse.path} className="toledot-verses__link">
            {verse.label}
          </Link>
          {verse.note ? <span className="toledot-verses__note"> — {verse.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}
