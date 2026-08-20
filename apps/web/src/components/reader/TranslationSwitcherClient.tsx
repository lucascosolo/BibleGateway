"use client";

import type { Translation } from "@/lib/db/corpus";

export interface TranslationSwitcherClientProps {
  translations: Translation[];
  active: Translation;
  onSelect: (code: string) => void;
}

/**
 * Same control as `<TranslationSwitcher>` — same markup, same CSS classes (`translation-switcher*`),
 * same behaviour — for callers that navigate imperatively instead of through `<Link>`.
 *
 * Derash pushes search params with `router.replace`/`.push` rather than following an `href`
 * (see `DerashSearch`), so it can't reuse the server component's `<Link>`-based options without
 * either shipping the server component's JS-free assumption or duplicating its whole DOM shape
 * from scratch. This file is that duplication, kept deliberately small and confined to the one
 * thing that differs — `<button onClick>` instead of `<Link href>` — so the two controls cannot
 * drift apart in appearance or interaction. See `TranslationSwitcher` for why `<details>` at all.
 */
export function TranslationSwitcherClient({ translations, active, onSelect }: TranslationSwitcherClientProps) {
  return (
    <details className="translation-switcher">
      <summary className="translation-switcher__summary">
        <span className="translation-switcher__active">
          <span className="translation-switcher__active-code">{active.code}</span>
          <span className="translation-switcher__active-name">{active.name}</span>
        </span>
        <span className="translation-switcher__chevron" aria-hidden="true" />
      </summary>

      <nav className="translation-switcher__panel" aria-label="Translation">
        {translations.map((option) => (
          <button
            key={option.code}
            type="button"
            className="translation-switcher__option"
            aria-current={option.code === active.code ? "page" : undefined}
            onClick={() => onSelect(option.code)}
          >
            <span className="translation-switcher__option-code">{option.code}</span>
            <span className="translation-switcher__option-name">{option.name}</span>
          </button>
        ))}
      </nav>
    </details>
  );
}
