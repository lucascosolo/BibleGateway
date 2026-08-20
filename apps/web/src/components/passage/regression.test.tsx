// @vitest-environment jsdom
/**
 * THE regression test — ARCHITECTURE §Phase 1.6.
 *
 * Mounts the SAME passage at all four densities simultaneously (as if it were open in a
 * hover tooltip, a preview card, a side panel, and the full reader at once), performs the
 * exact atom write `useAnnotationMutations`'s optimistic step (`onMutate`, §4.4 step 3)
 * performs, and asserts every mounted surface shows the new highlight in the same tick —
 * with no event bus, no manual invalidation, and no cross-view coordination code.
 *
 * If this test passes, the architectural bet (atoms keyed by verse_id, same identity the
 * views are keyed by) holds. If it doesn't, a second passage renderer or a broken
 * subscription boundary has crept in.
 */
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { getDefaultStore } from "jotai";

import { PassageRenderer, type PassageDensity } from "@/components/passage/PassageRenderer";
import { upsertAnnotation, type Annotation } from "@/lib/store/annotations";
import type { VerseText } from "@/lib/db/corpus";
import type { VerseId } from "@/lib/refs/verse-id";

const verse: VerseText = {
  verseId: 43003016 as VerseId,
  chapter: 3,
  verse: 16,
  text: "For God so loved the world",
  heatBucket: 0,
};

const range = { start: verse.verseId, end: verse.verseId };

const DENSITIES: PassageDensity[] = ["tooltip", "preview", "panel", "reader"];

function verseEl(density: PassageDensity): HTMLElement | null {
  return document.querySelector(`.surface-${density} [data-verse-id="${verse.verseId}"]`);
}

describe("universal persistence: one highlight, four mounted surfaces", () => {
  afterEach(cleanup);

  it("updates the tooltip, preview, panel and reader densities in the same tick", async () => {
    // Mount all four densities of the SAME passage at once — the scenario the whole
    // architecture exists to make trivial: a hover tooltip over John 3:16 while the reader
    // and a cross-reference panel showing the same verse are already on screen.
    for (const density of DENSITIES) {
      render(
        <PassageRenderer
          verses={[verse]}
          range={range}
          density={density}
          translationId={1}
          className={`surface-${density}`}
        />
      );
    }

    for (const density of DENSITIES) {
      expect(verseEl(density), `${density} density should have mounted`).not.toBeNull();
      expect(verseEl(density)?.querySelector(".deco-highlight")).toBeNull();
    }

    const highlight: Annotation = {
      annotationId: "optimistic-1",
      kind: "highlight",
      startVerseId: verse.verseId,
      endVerseId: verse.verseId,
      startOffset: null,
      endOffset: null,
      translationId: 1,
      quotedText: null,
      color: "amber",
      body: null,
      tags: [],
      updatedAt: new Date().toISOString(),
      pending: true,
    };

    // The exact write ARCHITECTURE §4.4 step 3 performs on `onMutate`, before the network
    // request even goes out: `store.set(upsertAnnotation, annotation, existingVerseIds)`.
    act(() => {
      getDefaultStore().set(upsertAnnotation, highlight, [verse.verseId]);
    });

    // All four surfaces, in the same tick, with no coordination code between them.
    for (const density of DENSITIES) {
      const hl = verseEl(density)?.querySelector(".deco-highlight");
      expect(hl, `${density} density should render the highlight`).not.toBeNull();
      expect(hl?.getAttribute("data-color")).toBe("amber");
      expect(hl?.getAttribute("data-pending")).toBe("true");
    }
  });
});
