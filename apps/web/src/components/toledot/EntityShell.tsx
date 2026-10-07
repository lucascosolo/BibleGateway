import Link from "next/link";
import type { ReactNode } from "react";

import type { ReviewStatus } from "@/lib/db/timeline";
import { yearOffset } from "@/lib/timeline/strip-layout";
import { formatRange, spanYears } from "@/lib/timeline/years";

import { DraftNotice } from "./DraftNotice";

/** The frame every Toledot entity page shares: the way back, the title, its facts line, the draft disclosure. */
export function EntityShell({ title, meta, status, children }: { title: string; meta: ReactNode; status: ReviewStatus; children: ReactNode }) {
  return (
    <article className="toledot-entity">
      <nav aria-label="Breadcrumb" className="toledot-entity__crumb">
        <Link href="/toledot">← Timeline</Link>
      </nav>
      <header className="toledot-entity__header">
        <h1 className="toledot-entity__title">{title}</h1>
        <p className="toledot-entity__meta">{meta}</p>
        {status === "draft" ? <DraftNotice /> : null}
      </header>
      {children}
    </article>
  );
}

export function EntitySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="toledot-section">
      <h2 className="toledot-section__title">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Where one range sits inside an envelope: a hairline track with the range ruled on it. Hidden
 * from assistive technology because the same range is printed as text beside it.
 */
export function RangeTrack({ from, to, earliest, latest }: { from: number; to: number; earliest: number; latest: number }) {
  const span = spanYears(from, to);
  if (span === 0) return null;
  const percentPerYear = 100 / span;
  return (
    <span className="toledot-track" aria-hidden="true" title={formatRange(earliest, latest)}>
      <span
        className="toledot-track__range"
        style={{ left: `${yearOffset(from, earliest, percentPerYear)}%`, width: `${spanYears(earliest, latest) * percentPerYear}%` }}
      />
    </span>
  );
}
