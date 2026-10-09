import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/support", () => ({ SUPPORT_URL: "https://pay.example/donate" }));

import { SupportCard } from "./SupportCard";

afterEach(cleanup);

describe("SupportCard", () => {
  it("links the whole card to /support", () => {
    render(<SupportCard />);
    const a = screen.getByText("Support Jot").closest("a")!;
    expect(a.getAttribute("href")).toBe("/support");
  });
});
