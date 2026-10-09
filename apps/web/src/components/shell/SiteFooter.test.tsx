import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const support = vi.hoisted(() => ({ SUPPORT_URL: "https://www.paypal.com/donate/?x=1" }));
vi.mock("@/lib/support", () => support);

import { SiteFooter } from "./SiteFooter";

afterEach(cleanup);

describe("SiteFooter privacy link", () => {
  it("links Privacy to /privacy", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
  });

  it("still renders Privacy when no support URL is configured", () => {
    support.SUPPORT_URL = "";
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
    support.SUPPORT_URL = "https://www.paypal.com/donate/?x=1";
  });
});
