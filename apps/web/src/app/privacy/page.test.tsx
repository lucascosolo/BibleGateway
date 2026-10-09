import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/support", () => ({ SUPPORT_URL: "https://www.paypal.com/donate/?x=1" }));

import PrivacyPage, { metadata } from "./page";

afterEach(cleanup);

describe("/privacy", () => {
  it("has metadata title Privacy", () => {
    expect(metadata.title).toBe("Privacy");
  });

  it("renders an h1 reading Privacy", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Privacy");
  });

  it("names the cookie and the localStorage keys", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("jot_uid");
    expect(text).toContain("jot-preferences");
    expect(text).toContain("jot-audio");
  });

  it("links to lucascosolo.com", () => {
    const { container } = render(<PrivacyPage />);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("https://lucascosolo.com");
  });

  it("links to or mentions PayPal", () => {
    const { container } = render(<PrivacyPage />);
    const linked = [...container.querySelectorAll("a")].some((a) =>
      (a.getAttribute("href") ?? "").startsWith("https://www.paypal.com"),
    );
    expect(linked || (container.textContent ?? "").includes("PayPal")).toBe(true);
  });
});
