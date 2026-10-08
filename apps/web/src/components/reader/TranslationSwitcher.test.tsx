import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Translation } from "@/lib/db/corpus";

import { TranslationSwitcher } from "./TranslationSwitcher";

const translations = [
  { code: "WEB", name: "World English Bible" },
  { code: "KJV", name: "King James Version" },
] as unknown as Translation[];

afterEach(cleanup);

describe("TranslationSwitcher audio marks", () => {
  it("marks only the translations that have a recording of this passage", () => {
    render(
      <TranslationSwitcher
        translations={translations}
        active={translations[0]}
        hrefFor={(code) => `/read/Gen.1?t=${code}`}
        withAudio={new Set(["WEB"])}
      />,
    );
    const web = screen.getByRole("link", { name: /World English Bible/ });
    const kjv = screen.getByRole("link", { name: /King James Version/ });
    expect(web.textContent).toMatch(/audio available/);
    expect(kjv.textContent).not.toMatch(/audio available/);
    expect(web.querySelector(".translation-switcher__option-audio-icon")).not.toBeNull();
    expect(kjv.querySelector(".translation-switcher__option-audio-icon")).toBeNull();
  });

  it("shows no marks when the page has no audio artifact", () => {
    render(
      <TranslationSwitcher translations={translations} active={translations[0]} hrefFor={(code) => `/read/Gen.1?t=${code}`} />,
    );
    expect(document.querySelector(".translation-switcher__option-audio")).toBeNull();
  });
});
