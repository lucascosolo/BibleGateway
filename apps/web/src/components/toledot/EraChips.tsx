import Link from "next/link";

import type { Era } from "@/lib/db/timeline";
import { formatRange } from "@/lib/timeline/years";

/**
 * One chip per era, plus "All eras". Each is a plain link, so the choice lives in the URL
 * (`?era=`), the server renders the chosen window, and a shared link lands on it. The chosen chip
 * carries `aria-current`, which is what a link inside navigation means by "selected".
 */
export function EraChips({ eras, selected }: { eras: readonly Era[]; selected: string | null }) {
  return (
    <nav aria-label="Era">
      <ul className="toledot-chips">
        <li>
          <Link href="/toledot" className="toledot-chip" aria-current={selected === null ? "true" : undefined} data-selected={selected === null}>
            All eras
          </Link>
        </li>
        {eras.map((era) => (
          <li key={era.id}>
            <Link prefetch={false}
              href={`/toledot?era=${era.id}`}
              className="toledot-chip"
              aria-current={selected === era.id ? "true" : undefined}
              data-selected={selected === era.id}
            >
              {era.name} <span className="toledot-chip__span">{formatRange(era.start, era.end)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
