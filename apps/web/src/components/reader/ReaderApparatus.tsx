"use client";

import { useState } from "react";

import { CrossRefPanel } from "@/components/crossrefs/CrossRefPanel";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useBreakpoint } from "@/lib/capability";

/**
 * How the cross-reference apparatus is reached, at every width.
 *
 * The problem this exists to solve: the apparatus is a sibling of the reading column so that at
 * ≥1280px it becomes a real second column instead of something floating over the text. That is
 * the right structure — but *below* 1280px the grid collapses to one column and a sibling that
 * follows the article follows the whole of it: all of John 3, then the pager, then the
 * translation copyright, and only then the cross-references. On a phone that is roughly four
 * thousand pixels of scrolling to reach the tool's primary research affordance, past two
 * end-of-document markers that tell the reader there is nothing further. In practice nobody
 * ever found it. There was no button, no drawer, and no per-verse entry point.
 *
 * So presentation is chosen here rather than left to the document flow:
 *
 *   ≥1280px  the panel renders inline, in the sticky aside, exactly as before.
 *   <1280px  a launcher pinned above the navigation opens the panel in a `<BottomSheet>`.
 *
 * Deliberately ONE `<CrossRefPanel>` in the tree, never one per presentation. The panel fetches
 * its own data from `/api/xrefs`; two mounts would be two requests for the same rows, and the
 * two copies would hold independent tab/filter state, so a researcher who set "strong links
 * only" on the phone sheet would find the desktop panel disagreeing with it after a rotation.
 *
 * Below desktop the panel is mounted only while the sheet is open, so a phone reader who never
 * opens the apparatus never pays for the request at all.
 *
 * `useBreakpoint` renders "phone" on the server and on the first client paint (see
 * lib/capability.ts) and corrects after mount. That is the same single correcting re-render
 * `<AppShell>` already performs around this subtree, in the same commit — this adds no new
 * flash of the wrong layout.
 */

export interface ReaderApparatusProps {
  /** OSIS slug for the passage on screen. */
  reference: string;
  translationCode: string;
  translationId: number;
}

export function ReaderApparatus({
  reference,
  translationCode,
  translationId,
}: ReaderApparatusProps) {
  const breakpoint = useBreakpoint();
  const [open, setOpen] = useState(false);

  if (breakpoint === "desktop") {
    return (
      <CrossRefPanel
        reference={reference}
        translationCode={translationCode}
        translationId={translationId}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        className="apparatus-launcher"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <LinkedIcon />
        <span className="apparatus-launcher__label">Cross-references</span>
      </button>

      {/* The sheet supplies the accessible name, so the panel's own duplicate <h2> is
          suppressed by `.xref-panel--sheet` in crossrefs.css rather than by editing the panel:
          it has to keep rendering that heading when it is docked in the desktop sidebar. */}
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Cross-references">
        <CrossRefPanel
          reference={reference}
          translationCode={translationCode}
          translationId={translationId}
          className="xref-panel--sheet"
        />
      </BottomSheet>
    </>
  );
}

/** Two linked passages. Decorative — the button is labelled by its own text. */
function LinkedIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13.5a4 4 0 0 0 5.66 0l2.6-2.6a4 4 0 0 0-5.66-5.66l-1.1 1.1" />
      <path d="M14 10.5a4 4 0 0 0-5.66 0l-2.6 2.6a4 4 0 1 0 5.66 5.66l1.1-1.1" />
    </svg>
  );
}
