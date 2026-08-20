"use client";

import { useEffect, useState } from "react";

/**
 * useCapability() — ARCHITECTURE.md §4.7.1
 *
 * Feature availability is a deliberate, documented editorial decision, not
 * an ad-hoc `md:` class scattered per component. Components branch on a
 * single value instead of reimplementing the cut themselves.
 *
 * Governing rule: if a feature's value comes from comparing many columns
 * at once, or from a large 2-D canvas, it is desktop-only. If the
 * information is fundamentally linear, it works on mobile — reduced, not
 * hidden. Cuts are always disclosed in the UI, never silent.
 */

export type CapabilityLevel = "full" | "reduced" | "unavailable";
export type Breakpoint = "phone" | "tablet" | "desktop";

export type FeatureKey =
  | "reader"
  | "selahMode"
  | "translationSwitcher"
  | "search"
  | "bookMetadata"
  | "crossReferences"
  | "languageChart"
  | "timeline"
  | "manuscripts"
  | "variants"
  | "originalLanguage"
  | "atlas"
  | "referenceGraph"
  | "parallelCompare"
  | "sourceCriticism"
  | "studyComposer";

interface FeatureAvailability {
  phone: CapabilityLevel;
  tablet: CapabilityLevel;
  desktop: CapabilityLevel;
  /** Why the cut was made at each size, for the next person touching this file. */
  reason: string;
}

export const CAPABILITY_MATRIX: Record<FeatureKey, FeatureAvailability> = {
  reader: {
    phone: "full",
    tablet: "full",
    desktop: "full",
    reason: "The reader is the product. It never degrades.",
  },
  selahMode: {
    phone: "full",
    tablet: "full",
    desktop: "full",
    reason: "A single toggle that hides layers — no width dependency at all.",
  },
  translationSwitcher: {
    phone: "full",
    tablet: "full",
    desktop: "full",
    reason: "Place-preserving swap is one dropdown; costs nothing at any width.",
  },
  search: {
    phone: "full",
    tablet: "full",
    desktop: "full",
    reason: "Text/lemma/semantic search is a linear results list at every size.",
  },
  bookMetadata: {
    phone: "full",
    tablet: "full",
    desktop: "full",
    reason: "A stacked card of prose; reflows without losing information.",
  },
  crossReferences: {
    phone: "reduced",
    tablet: "reduced",
    desktop: "full",
    reason:
      "Ranked list works everywhere; the inline hover preview needs docked panel space so it only turns on at desktop.",
  },
  languageChart: {
    phone: "full",
    tablet: "full",
    desktop: "full",
    reason: "One donut, one scope selector — no 2-D canvas involved.",
  },
  timeline: {
    phone: "reduced",
    tablet: "reduced",
    desktop: "full",
    reason:
      "A multi-track horizontal canvas needs real width to compare tracks; phone gets a vertical era/book list, tablet gets two horizontal tracks.",
  },
  manuscripts: {
    phone: "reduced",
    tablet: "reduced",
    desktop: "full",
    reason:
      "The family tree is a 2-D diagram; below desktop it collapses to a witness list plus detail sheet.",
  },
  variants: {
    phone: "reduced",
    tablet: "reduced",
    desktop: "full",
    reason:
      "The full witness table is column-heavy; phone shows the preferred reading plus an 'N variants' sheet.",
  },
  originalLanguage: {
    phone: "reduced",
    tablet: "reduced",
    desktop: "full",
    reason:
      "The interlinear grid needs row alignment across words; phone/tablet get a tap-word popover instead.",
  },
  atlas: {
    phone: "reduced",
    tablet: "full",
    desktop: "full",
    reason:
      "The map itself works at any size; animated journey arcs are dropped on phone to keep the map legible and touch-usable.",
  },
  referenceGraph: {
    phone: "unavailable",
    tablet: "unavailable",
    desktop: "full",
    reason:
      "A force-directed graph is unusable under ~1024px of stable width. Below desktop, the deep dive is a ranked list — same data, honest interface, not a crammed canvas.",
  },
  parallelCompare: {
    phone: "full",
    tablet: "full",
    desktop: "full",
    reason:
      "The current English comparison is verse-aligned: desktop uses two columns and phone stacks editions inside each canonical verse. MT/LXX comparison remains roadmap work.",
  },
  sourceCriticism: {
    phone: "reduced",
    tablet: "reduced",
    desktop: "full",
    reason:
      "Comparing hypotheses side by side is the whole point of the feature and needs multiple columns; below desktop it's a single-hypothesis overlay you can switch, not compare.",
  },
  studyComposer: {
    phone: "unavailable",
    tablet: "reduced",
    desktop: "full",
    reason:
      "Composing and exporting a document is a writing-desk task; phone can read existing compositions but not build one.",
  },
};

function getBreakpoint(width: number): Breakpoint {
  if (width >= 1280) return "desktop";
  if (width >= 768) return "tablet";
  return "phone";
}

/**
 * SSR-safe by construction: the server (and the client's first render)
 * always assume "phone" — the narrowest, most conservative breakpoint —
 * so the very first paint is identical on both sides and React never
 * detects a hydration mismatch. The real breakpoint is measured only
 * after mount, inside `useEffect`, which is client-only by definition and
 * produces a normal post-hydration re-render rather than a mismatch.
 */
export function useCapability(feature: FeatureKey): CapabilityLevel {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("phone");

  useEffect(() => {
    const update = () => setBreakpoint(getBreakpoint(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return CAPABILITY_MATRIX[feature][breakpoint];
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("phone");
  useEffect(() => {
    const update = () => setBreakpoint(getBreakpoint(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return breakpoint;
}
