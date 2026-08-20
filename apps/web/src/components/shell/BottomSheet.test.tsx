// Regression: modal surfaces must escape their trigger's stacking context.
//
// The bug this pins: `<BottomSheet>` rendered in place, and every trigger for it lives inside
// the nav rail, which is `position: sticky`. Sticky ALWAYS establishes a stacking context, so
// the sheet's `z-50` ranked it only against the rail's own children while the rail sat at
// z-index auto among its siblings — and the reader and cross-reference aside, which come later
// in DOM order, painted straight over an opaque panel. It looked exactly like a transparent
// background, which is how it was reported, and the panel's computed `background-color` was a
// fully opaque colour the whole time.
//
// jsdom has no compositor, so this cannot assert paint order. It asserts the property that
// makes paint order correct and is the thing a future edit would break: the overlay is a direct
// child of <body>, not a descendant of whatever rendered it. That is a real invariant — revert
// the `createPortal` call and this test fails.

import { useRef } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BottomSheet } from "./BottomSheet";
import { AnchoredPanel } from "./AnchoredPanel";
import { NoteComposer } from "../passage/NoteComposer";

/** Stands in for the nav rail: an ancestor that establishes a stacking context. */
function StickyChrome({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="page">
      <aside data-testid="chrome" style={{ position: "sticky", top: 0 }}>
        {children}
      </aside>
      <main data-testid="later-sibling">Genesis 1</main>
    </div>
  );
}

// This config does not set `globals: true`, so Testing Library never registers its automatic
// `afterEach(cleanup)`. That is harmless for a test querying inside its own container, but these
// render into <body> — without an explicit cleanup each test inherits the previous test's dialog
// and `getByRole("dialog")` fails with "multiple elements found".
afterEach(cleanup);

describe("modal surfaces escape their container", () => {
  it("portals the bottom sheet out to <body>", () => {
    render(
      <StickyChrome>
        <BottomSheet open onClose={() => {}} title="Reading layers">
          <p>layer toggles</p>
        </BottomSheet>
      </StickyChrome>
    );

    const dialog = screen.getByRole("dialog");
    const chrome = screen.getByTestId("chrome");

    expect(chrome.contains(dialog)).toBe(false);

    // The overlay — the full-screen positioned element, not the panel — is what has to sit at
    // the top level for z-index to be measured against the page rather than against the rail.
    const overlay = dialog.parentElement!;
    expect(overlay.parentElement).toBe(document.body);
  });

  it("portals the note composer out to <body>", () => {
    render(
      <StickyChrome>
        <NoteComposer title="Note" saveLabel="Save" onSave={() => {}} onCancel={() => {}} />
      </StickyChrome>
    );

    const dialog = screen.getByRole("dialog");
    expect(screen.getByTestId("chrome").contains(dialog)).toBe(false);
    expect(dialog.parentElement!.parentElement).toBe(document.body);
  });

  // The desktop presentation of the same panel. It is anchored to a trigger that lives in the
  // very same sticky rail, so it inherits the identical stacking-context trap — and unlike the
  // sheet, "position it near the button" is a standing temptation to render it as a sibling of
  // the button. It must not be.
  it("portals the anchored panel out to <body>", () => {
    function Harness() {
      const anchorRef = useRef<HTMLButtonElement>(null);
      return (
        <StickyChrome>
          <button type="button" ref={anchorRef}>
            Pardes
          </button>
          <AnchoredPanel open onClose={() => {}} title="Pardes" anchorRef={anchorRef}>
            <p>layer toggles</p>
          </AnchoredPanel>
        </StickyChrome>
      );
    }
    render(<Harness />);

    const dialog = screen.getByRole("dialog");
    expect(screen.getByTestId("chrome").contains(dialog)).toBe(false);
    expect(dialog.parentElement!.parentElement).toBe(document.body);
  });

  it("renders nothing at all when the sheet is closed", () => {
    render(
      <StickyChrome>
        <BottomSheet open={false} onClose={() => {}} title="Reading layers">
          <p>layer toggles</p>
        </BottomSheet>
      </StickyChrome>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
