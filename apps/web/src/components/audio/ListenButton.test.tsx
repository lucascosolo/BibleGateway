import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useAudioStore } from "@/lib/store/audio";

import { ListenButton } from "./ListenButton";

afterEach(cleanup);
beforeEach(() => {
  useAudioStore.setState({ choice: "translation" });
});

describe("ListenButton", () => {
  it("plays the translation's own recording when it has one", () => {
    render(<ListenButton choices={["translation", "original"]} translationCode="WEB" />);
    const button = screen.getByRole("button", { name: /^Listen$/ });
    fireEvent.click(button);
    expect(useAudioStore.getState().choice).toBe("translation");
  });

  it("is unavailable for a translation without a recording, and offers the Hebrew by name", () => {
    render(<ListenButton choices={["original"]} translationCode="KJV" />);
    const none = screen.getByRole("button", { name: /No KJV audio/ });
    expect(none.getAttribute("aria-disabled")).toBe("true");
    expect(none.getAttribute("title")).toMatch(/speaker mark/);
    fireEvent.click(screen.getByRole("button", { name: /Hebrew/ }));
    expect(useAudioStore.getState().choice).toBe("original");
  });

  it("offers nothing to play when no recording covers the page", () => {
    render(<ListenButton choices={[]} translationCode="JPS" />);
    expect(screen.getByRole("button", { name: /No JPS audio/ }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("button", { name: /Hebrew/ })).toBeNull();
  });
});
