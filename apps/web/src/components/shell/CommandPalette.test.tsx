import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/support", () => ({ SUPPORT_URL: "https://pay.example/donate" }));

import { CommandPalette } from "./CommandPalette";

afterEach(cleanup);

describe("CommandPalette", () => {
  it("lists Support Jot", () => {
    render(<CommandPalette />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    });
    const a = Array.from(document.querySelectorAll("a")).find((l) => l.textContent === "Support Jot");
    expect(a?.getAttribute("href")).toBe("/support");
  });
});
