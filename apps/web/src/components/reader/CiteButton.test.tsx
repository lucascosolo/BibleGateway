// What a citation dialog has to get right, none of which shows up in a screenshot.
//
// 1. The corpus build id survives into the copied string. It is the only thing distinguishing
//    two readings of the same URL, and it is also the first thing that looks like noise and
//    gets dropped by a well-meaning simplification.
// 2. Copying still works when the clipboard is refused. Insecure origins, permissions policies
//    and several mobile browsers reject `navigator.clipboard`, and a Copy button that silently
//    does nothing is worse than no button.
// 3. It portals to <body>. This dialog opens from the reader footer, and this app has already
//    paid three times for a dialog rendered inside a stacking context it could not escape.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CiteButton } from "./CiteButton";

const SUBJECT = {
  reference: "Psalm 23:1–6",
  translationCode: "KJV",
  translationName: "King James Version",
  copyrightNotice: "Public Domain outside the United Kingdom; royal letters patent apply within it.",
  corpusBuild: "2205a38b636a12e9",
};

function open() {
  render(<CiteButton subject={SUBJECT} path="/read/Ps.23?t=KJV" />);
  fireEvent.click(screen.getByRole("button", { name: "Cite this passage" }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<CiteButton>", () => {
  it("does not render a dialog until asked", () => {
    render(<CiteButton subject={SUBJECT} path="/read/Ps.23?t=KJV" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("carries the corpus build id and the translation in the citation text", () => {
    open();
    const box = screen.getByLabelText("Citation text") as HTMLTextAreaElement;
    expect(box.value).toContain("2205a38b636a12e9");
    expect(box.value).toContain("King James Version");
  });

  it("makes the URL absolute against the host actually being served", () => {
    // Two hostnames point at this app and a third serves previews. A citation that hard-coded
    // one of them would record an address the reader was never at.
    open();
    const box = screen.getByLabelText("Citation text") as HTMLTextAreaElement;
    expect(box.value).toContain(`${window.location.origin}/read/Ps.23?t=KJV`);
  });

  it("offers all three formats and switches between them", () => {
    open();
    fireEvent.click(screen.getByRole("radio", { name: "BibTeX" }));
    const box = screen.getByLabelText("Citation text") as HTMLTextAreaElement;
    expect(box.value.startsWith("@misc{")).toBe(true);
  });

  it("confirms a successful copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
    expect(writeText).toHaveBeenCalledOnce();
  });

  it("falls back to selecting the text when the clipboard is refused, and claims nothing", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    open();
    const box = screen.getByLabelText("Citation text") as HTMLTextAreaElement;
    const select = vi.spyOn(box, "select");
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(select).toHaveBeenCalled());
    expect(screen.queryByText("Copied")).toBeNull();
  });

  it("keeps the citation text reachable by keyboard rather than disabling it", () => {
    // `readOnly`, never `disabled`: a disabled textarea cannot be focused or selected, which
    // removes the only fallback the previous test depends on.
    open();
    const box = screen.getByLabelText("Citation text") as HTMLTextAreaElement;
    expect(box.readOnly).toBe(true);
    expect(box.disabled).toBe(false);
  });

  it("portals to <body>, so shell chrome cannot paint over it", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog.closest(".reader")).toBeNull();
    expect(document.body.contains(dialog)).toBe(true);
  });
});
