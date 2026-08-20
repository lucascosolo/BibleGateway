"use client";

import { useEffect, useState } from "react";

import { LayerRow, layerRows } from "@/components/shell/LayerControls";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import type { Translation } from "@/lib/db/corpus";
import { usePreferencesStore } from "@/lib/store/preferences";

/**
 * The setup screen inside the guided tour: every default the product ships with, changeable in
 * one place, applying immediately.
 *
 * **Why it is the second-to-last step and not the first.** "Initial configuration" argues for
 * putting it up front, and that was the first shape. It was wrong for a plain reason: the
 * switches are named `Reference heat`, `Variant readings` and `Original language`, and a reader
 * who has not yet been told what those layers are cannot make a decision about them. Asked to
 * choose before being told, almost everyone presses Next. Placed after the eight steps that
 * explain each feature, the same eight switches are a summary of what was just described — and
 * every choice on this screen is one the reader can now actually make.
 *
 * **It writes through the same store as the real settings, not a draft.** There is no Apply
 * button and no staged copy. Flipping a switch here flips the identical preference the reading
 * panel flips, persisted to localStorage by the same middleware, so what a reader sets during
 * onboarding is not a separate first-run configuration that can disagree with the app's actual
 * state later. The cost is that Back does not undo — which is what `Restore defaults` is for,
 * stated on the button rather than implied.
 *
 * **The rows are imported, never retyped.** `layerRows()` and `<LayerRow>` come from
 * `LayerControls`, which is the production settings surface. A second hand-written list of
 * layers is how a switch gets added in one place and silently missing from the other — and the
 * failure mode is invisible, because both screens look complete.
 */
export function TourSetup() {
  const layers = usePreferencesStore((s) => s.layers);
  const toggleLayer = usePreferencesStore((s) => s.toggleLayer);
  const plainLabels = usePreferencesStore((s) => s.plainLabels);
  const togglePlainLabels = usePreferencesStore((s) => s.togglePlainLabels);
  const translation = usePreferencesStore((s) => s.translation);
  const setTranslation = usePreferencesStore((s) => s.setTranslation);
  const resetSettings = usePreferencesStore((s) => s.resetSettings);

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Appearance"
        note="Light, dark, or whatever this device is already set to."
      >
        <ThemeToggle />
      </Section>

      <Section
        title="Which Bible opens by default"
        note="You can switch translation on any passage without losing your place, so this is only the one you start in."
      >
        <TranslationChoice value={translation} onChange={setTranslation} />
      </Section>

      <Section
        title="What sits beside the text"
        note="These are the reading layers from a moment ago. Change your mind any time — the same switches live in the reading settings on every screen."
      >
        <div className="flex flex-col gap-0.5">
          {layerRows(plainLabels).map((row) => (
            <LayerRow
              key={row.key}
              label={row.label}
              description={row.description}
              checked={layers[row.key]}
              onChange={() => toggleLayer(row.key)}
            />
          ))}
        </div>
      </Section>

      <Section title="Wording" note="">
        <LayerRow
          label="Plain labels"
          description="Swaps Selah, Pardes, Lashon and the rest for ordinary English."
          checked={plainLabels}
          onChange={togglePlainLabels}
        />
      </Section>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
        <p className="font-sans text-[var(--text-xs)] text-[var(--color-ink-faint)]">
          Changes save as you make them.
        </p>
        {/* Named for what it does rather than "Reset", which reads as though it might also
            discard notes and highlights. It touches settings only. */}
        <button
          type="button"
          onClick={resetSettings}
          className="min-h-[var(--touch-target)] shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 font-sans text-[var(--text-sm)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)]"
        >
          Restore defaults
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-sans text-[var(--text-xs)] font-semibold tracking-[0.06em] text-[var(--color-ink-faint)] uppercase">
        {title}
      </h3>
      {note && (
        <p className="font-sans text-[var(--text-xs)] leading-snug text-[var(--color-ink-muted)]">
          {note}
        </p>
      )}
      {children}
    </section>
  );
}

/**
 * The list is fetched rather than passed in, because this dialog is mounted by `<AppShell>` on
 * every page in the app — including ones that never open the database. See
 * `app/api/translations/route.ts`.
 *
 * Three states, all rendered, none of them a spinner over an empty box:
 *   - loading: the reader's current choice, stated, so the section is never blank;
 *   - failed: the same, plus an honest line saying the list could not be loaded;
 *   - loaded: the radio group.
 * A network failure here must not strand the reader inside a modal with a section that never
 * resolves, so the failure path leaves them with a valid preference and a Next button.
 */
function TranslationChoice({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [translations, setTranslations] = useState<Translation[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // `AbortController` rather than a mounted flag: the tour can be dismissed mid-flight, and
    // aborting stops the request instead of merely ignoring its answer.
    const controller = new AbortController();
    fetch("/api/translations", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ translations: Translation[] }>;
      })
      .then((body) => setTranslations(body.translations))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, []);

  if (!translations) {
    return (
      <p className="font-sans text-[var(--text-sm)] text-[var(--color-ink-muted)]">
        Currently <strong className="font-semibold text-[var(--color-ink)]">{value}</strong>.
        {failed
          ? " The full list could not be loaded — you can change it from the translation control above any passage."
          : " Loading the others…"}
      </p>
    );
  }

  return (
    <div role="radiogroup" aria-label="Default translation" className="flex flex-col gap-0.5">
      {translations.map((option) => {
        const active = option.code === value;
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.code)}
            className={
              "flex min-h-[var(--touch-target)] w-full items-baseline gap-2 rounded-[var(--radius-md)] px-2 py-2 text-start " +
              (active
                ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]"
                : "text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]")
            }
          >
            <span className="w-12 shrink-0 font-mono text-[var(--text-xs)] font-semibold">
              {option.code}
            </span>
            <span className="min-w-0">
              <span className="block font-sans text-[var(--text-sm)]">{option.name}</span>
              {/* Partial editions say so here. JPS 1917 is the Hebrew Bible only, and a reader
                  who picks it as their default and then opens John should have been told. */}
              {option.scopeNote && (
                <span className="block font-sans text-[var(--text-xs)] leading-snug text-[var(--color-ink-faint)]">
                  {option.scopeNote}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
