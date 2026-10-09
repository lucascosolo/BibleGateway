import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/support", () => ({ SUPPORT_URL: "https://pay.example/donate" }));

import SupportPage from "./page";

afterEach(cleanup);

describe("/support", () => {
  it("renders the donate button opening SUPPORT_URL in a new tab", () => {
    render(<SupportPage />);
    const a = screen.getByText("Donate with PayPal").closest("a")!;
    expect(a.getAttribute("href")).toBe("https://pay.example/donate");
    expect(a.getAttribute("target")).toBe("_blank");
  });
});
