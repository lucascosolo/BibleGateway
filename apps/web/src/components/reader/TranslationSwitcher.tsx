import Link from "next/link";
import type { ComponentProps } from "react";

import type { Translation } from "@/lib/db/corpus";

export interface TranslationSwitcherProps {
  translations: Translation[];
  active: Translation;
  hrefFor: (code: string) => string;
  /** Extra props forwarded to every `<Link>` — e.g. the reader's `replace` + `scroll={false}`,
   * which keeps the scroll position and history entry stable across a translation switch.
   * Callers that navigate imperatively (derash) don't use this component at all; see below. */
  linkProps?: Omit<ComponentProps<typeof Link>, "href" | "className" | "aria-current" | "title" | "children">;
}

/**
 * The list of every translation, everywhere it appears.
 *
 * A `<details>`/`<summary>` disclosure, not a horizontal row of code pills. Three reasons, all
 * of which stop applying to a pill row once the corpus carries more than two or three
 * translations:
 *
 * - A horizontal scroller hides options behind a gesture with no affordance. Nothing on
 *   screen tells a reader there is more to the row than what fits, so the extra translations
 *   are present in the DOM and effectively unreachable — a correct DOM order that isn't a
 *   reachable one (see AGENTS.md).
 * - `flex-wrap` on ten-plus opaque three-letter codes turns the header into a wall of jargon,
 *   and at 320px it still grows to several rows before the reading column even starts.
 * - `<details>` degrades the other direction: it cannot clip at any width, its cost scales
 *   with the list rather than blowing a fixed budget, it shows the real name next to the code
 *   instead of asking the reader to already know what "DBY" is, needs no focus-trap or
 *   outside-click machinery, and its DOM order is its focus order by construction.
 *
 * Server component, no JS: `<details>` is native disclosure, and every entry is a real link
 * (or, via `linkProps`, whatever the caller wants a link to do), so it works with JS disabled
 * and costs nothing on the client bundle.
 */
export function TranslationSwitcher({ translations, active, hrefFor, linkProps }: TranslationSwitcherProps) {
  return (
    <details className="translation-switcher">
      {/* The accessible name has to say what the control DOES. "KJV King James Version" alone
          describes the current state and leaves a screen-reader user to infer that activating
          it offers alternatives — so the purpose is stated in text, visible to everyone, rather
          than hidden in a title attribute nobody but a mouse user ever receives. */}
      <summary className="translation-switcher__summary">
        <span className="translation-switcher__label">Translation</span>
        <span className="translation-switcher__active">
          <span className="translation-switcher__active-code">{active.code}</span>
          <span className="translation-switcher__active-name">{active.name}</span>
        </span>
        <span className="translation-switcher__chevron" aria-hidden="true" />
      </summary>

      <nav className="translation-switcher__panel" aria-label="Translation">
        {translations.map((option) => (
          <Link
            key={option.code}
            href={hrefFor(option.code)}
            className="translation-switcher__option"
            aria-current={option.code === active.code ? "page" : undefined}
            {...linkProps}
          >
            <span className="translation-switcher__option-code">{option.code}</span>
            <span className="translation-switcher__option-name">{option.name}</span>
          </Link>
        ))}
      </nav>
    </details>
  );
}
