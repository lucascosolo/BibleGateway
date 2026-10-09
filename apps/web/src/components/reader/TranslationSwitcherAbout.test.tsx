import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Translation } from "@/lib/db/corpus";

import { TranslationSwitcher } from "./TranslationSwitcher";
import { TranslationSwitcherClient } from "./TranslationSwitcherClient";

const translations = [
  { code: "WEB", name: "World English Bible" },
  { code: "KJV", name: "King James Version" },
] as unknown as Translation[];

afterEach(cleanup);

function expectAboutLink() {
  const link = screen.getByRole("link", { name: "About these translations", hidden: true });
  expect(link.getAttribute("href")).toBe("/translations");
  expect(link.closest("details")).not.toBeNull();
}

describe("translation switcher about link", () => {
  it("server switcher links to /translations inside the details", () => {
    render(<TranslationSwitcher translations={translations} active={translations[0]} hrefFor={(c) => `/read/Gen.1?t=${c}`} />);
    expectAboutLink();
  });

  it("client switcher links to /translations inside the details", () => {
    render(<TranslationSwitcherClient translations={translations} active={translations[0]} onSelect={() => {}} />);
    expectAboutLink();
  });
});
