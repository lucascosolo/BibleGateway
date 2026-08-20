"use client";

import { ReaderApparatus } from "@/components/reader/ReaderApparatus";
import { useEffectiveLayers } from "@/lib/store/preferences";

/**
 * The reader's cross-reference column, gated on the layer it belongs to.
 *
 * Two claims the app was making and not keeping meet in this component:
 *
 * 1. `<LayerControls>` offers a "Cross-references" (Testimonia) toggle. Nothing rendered
 *    differently when it flipped — `PassageRenderer` threads `layers.crossRefs` down to
 *    `<Verse>`, which never reads it, so the switch moved and the page did not. This aside IS
 *    the cross-reference layer in the shipped build, so it is what the toggle now governs.
 *    Wiring it to an inline per-verse marker instead would have meant a new per-verse
 *    cross-reference count on every render path to decorate text with something the panel
 *    beside it already shows better.
 *
 * 2. Selah is described as hiding every layer. It stripped the renderer's decorations and left
 *    a 40-row ranked cross-reference panel next to the text — the single loudest piece of
 *    apparatus on the page survived the mode that exists to remove apparatus. `useEffectiveLayers`
 *    already folds Selah over the saved toggles, so both come from one read.
 *
 * A client component wrapping a server-rendered position: the reader page stays a server
 * component and the preference lives in a localStorage-backed store, so the branch has to
 * happen here. It matches how `<PassageRenderer>` already reads the same store.
 */
export function CrossRefAside({
  reference,
  translationCode,
  translationId,
}: {
  reference: string;
  translationCode: string;
  translationId: number;
}) {
  const layers = useEffectiveLayers();
  if (!layers.crossRefs) return null;

  return (
    // Testimonia — "chains of linked passages that testify to one another".
    // A sibling of the reader rather than a child, so at wide widths it becomes a real
    // second column instead of something floating over the text.
    //
    // What happens BELOW that width is `<ReaderApparatus>`'s decision, not this element's:
    // letting the collapsed grid drop the panel beneath the passage meant it sat after all of
    // John 3, the pager and the copyright, with no button or drawer to reach it. Below 1280px
    // it becomes a pinned launcher and a bottom sheet instead.
    <aside className="reader-aside" aria-label="Cross-references">
      <ReaderApparatus
        reference={reference}
        translationCode={translationCode}
        translationId={translationId}
      />
    </aside>
  );
}
