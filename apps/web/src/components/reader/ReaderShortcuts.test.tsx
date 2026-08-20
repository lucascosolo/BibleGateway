// A global keydown listener is the easiest thing in a web app to get subtly, invisibly wrong.
// These are the three ways this one could hurt someone, each pinned:
//
//   1. Swallowing a keystroke meant for a text field. A reader typing a note who presses `]`
//      must get a bracket, not the next chapter — and must not lose the sentence they were in.
//   2. Claiming a modifier combination the browser or OS already owns.
//   3. Navigating somewhere invented at the ends of a book, or turning the page underneath an
//      open dialog.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReaderShortcuts } from "./ReaderShortcuts";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const PREV = "/read/Gen.1?t=WEB";
const NEXT = "/read/Gen.3?t=WEB";

beforeEach(() => push.mockClear());
afterEach(cleanup);

describe("<ReaderShortcuts>", () => {
  it("turns the page with ] and [", () => {
    render(<ReaderShortcuts prevHref={PREV} nextHref={NEXT} />);
    fireEvent.keyDown(window, { key: "]" });
    expect(push).toHaveBeenCalledWith(NEXT);
    fireEvent.keyDown(window, { key: "[" });
    expect(push).toHaveBeenCalledWith(PREV);
  });

  it("accepts the arrow keys as an alias", () => {
    render(<ReaderShortcuts prevHref={PREV} nextHref={NEXT} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(push).toHaveBeenCalledTimes(2);
  });

  it("does nothing at the ends of a book rather than inventing a destination", () => {
    render(<ReaderShortcuts prevHref={null} nextHref={null} />);
    fireEvent.keyDown(window, { key: "]" });
    fireEvent.keyDown(window, { key: "[" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores keys typed into a text field", () => {
    render(
      <>
        <textarea aria-label="note" />
        <ReaderShortcuts prevHref={PREV} nextHref={NEXT} />
      </>,
    );
    const note = screen.getByLabelText("note");
    note.focus();
    fireEvent.keyDown(note, { key: "]" });
    fireEvent.keyDown(note, { key: "ArrowRight" });
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores keys typed into a contenteditable, not just a <textarea>", () => {
    render(
      <>
        <div contentEditable suppressContentEditableWarning data-testid="rich" />
        <ReaderShortcuts prevHref={PREV} nextHref={NEXT} />
      </>,
    );
    const rich = screen.getByTestId("rich");
    // jsdom does not implement `isContentEditable` from the attribute, so it is set directly —
    // the attribute alone would make this test pass against a component that only checked
    // tag names, which is exactly the bug it exists to catch.
    Object.defineProperty(rich, "isContentEditable", { value: true });
    fireEvent.keyDown(rich, { key: "]" });
    expect(push).not.toHaveBeenCalled();
  });

  it("leaves modifier combinations to the browser", () => {
    render(<ReaderShortcuts prevHref={PREV} nextHref={NEXT} />);
    fireEvent.keyDown(window, { key: "]", metaKey: true });
    fireEvent.keyDown(window, { key: "]", ctrlKey: true });
    fireEvent.keyDown(window, { key: "ArrowRight", altKey: true });
    expect(push).not.toHaveBeenCalled();
  });

  it("does not turn the page underneath an open dialog", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    render(<ReaderShortcuts prevHref={PREV} nextHref={NEXT} />);
    fireEvent.keyDown(window, { key: "]" });
    expect(push).not.toHaveBeenCalled();
    dialog.remove();
  });

  it("shows the shortcut list on ?, and it is discoverable at all", () => {
    // The bindings are worthless if nobody knows they exist, and `?` is the convention every
    // other keyboard-driven site uses for exactly this.
    render(<ReaderShortcuts prevHref={PREV} nextHref={NEXT} />);
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Next chapter")).toBeTruthy();
  });

  it("stops listening when unmounted", () => {
    // A global listener that outlives its component turns the page on a route it no longer
    // belongs to — and it is invisible until it happens.
    const { unmount } = render(<ReaderShortcuts prevHref={PREV} nextHref={NEXT} />);
    unmount();
    fireEvent.keyDown(window, { key: "]" });
    expect(push).not.toHaveBeenCalled();
  });
});
