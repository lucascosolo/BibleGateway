"use client";

import { useState } from "react";
import clsx from "clsx";
import { Wordmark } from "@/components/Wordmark";
import { GlossLabel } from "@/components/GlossLabel";
import { lexicon, type LexiconId } from "@/lib/lexicon";
import { usePreferencesStore } from "@/lib/store/preferences";
import { useBreakpoint, useCapability, CAPABILITY_MATRIX, type FeatureKey } from "@/lib/capability";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { SelahToggle } from "@/components/shell/SelahToggle";
import { BottomSheet } from "@/components/shell/BottomSheet";

const PALETTE_GROUPS: { title: string; tokens: { name: string; varName: string }[] }[] = [
  {
    title: "Surfaces",
    tokens: [
      { name: "bg", varName: "--color-bg" },
      { name: "bg-raised", varName: "--color-bg-raised" },
      { name: "bg-sunken", varName: "--color-bg-sunken" },
      { name: "surface", varName: "--color-surface" },
      { name: "surface-hover", varName: "--color-surface-hover" },
    ],
  },
  {
    title: "Ink",
    tokens: [
      { name: "ink", varName: "--color-ink" },
      { name: "ink-muted", varName: "--color-ink-muted" },
      { name: "ink-faint", varName: "--color-ink-faint" },
    ],
  },
  {
    title: "Brand — verdigris + rubric",
    tokens: [
      { name: "brand", varName: "--color-brand" },
      { name: "brand-strong", varName: "--color-brand-strong" },
      { name: "brand-soft", varName: "--color-brand-soft" },
      { name: "rubric", varName: "--color-rubric" },
      { name: "rubric-strong", varName: "--color-rubric-strong" },
      { name: "rubric-soft", varName: "--color-rubric-soft" },
    ],
  },
  {
    title: "Borders",
    tokens: [
      { name: "border", varName: "--color-border" },
      { name: "border-strong", varName: "--color-border-strong" },
    ],
  },
  {
    title: "Highlights",
    tokens: [
      { name: "amber", varName: "--color-highlight-amber" },
      { name: "rose", varName: "--color-highlight-rose" },
      { name: "moss", varName: "--color-highlight-moss" },
      { name: "sky", varName: "--color-highlight-sky" },
    ],
  },
];

const TYPE_SCALE = ["xs", "sm", "base", "md", "lg", "xl", "2xl", "3xl"] as const;

const FEATURE_ORDER: FeatureKey[] = [
  "reader",
  "selahMode",
  "translationSwitcher",
  "search",
  "bookMetadata",
  "crossReferences",
  "languageChart",
  "timeline",
  "manuscripts",
  "variants",
  "originalLanguage",
  "atlas",
  "referenceGraph",
  "parallelCompare",
  "sourceCriticism",
  "studyComposer",
];

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-14">
      <p className="font-sans text-[var(--text-xs)] font-semibold uppercase tracking-[0.14em] text-[var(--color-rubric)]">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-serif text-[var(--text-xl)] font-semibold text-[var(--color-ink)]">
        {title}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function CapabilityBadge({ level }: { level: "full" | "reduced" | "unavailable" }) {
  const styles: Record<typeof level, string> = {
    full: "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] border-[var(--color-brand)]",
    reduced: "bg-[var(--color-rubric-soft)] text-[var(--color-rubric-strong)] border-[var(--color-rubric)]",
    unavailable: "bg-[var(--color-bg-sunken)] text-[var(--color-ink-faint)] border-[var(--color-border)]",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-[var(--radius-full)] border px-2.5 py-1 text-[var(--text-xs)] font-semibold uppercase tracking-wide",
        styles[level],
      )}
    >
      {level}
    </span>
  );
}

function CurrentCapability({ feature }: { feature: FeatureKey }) {
  const level = useCapability(feature);
  return <CapabilityBadge level={level} />;
}

export default function StylePage() {
  const plainLabels = usePreferencesStore((s) => s.plainLabels);
  const togglePlainLabels = usePreferencesStore((s) => s.togglePlainLabels);
  const breakpoint = useBreakpoint();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="pb-24">
      {/* Hero */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
        <Wordmark size="xl" withVerse className="mx-auto items-center" />
        <h1 className="mt-8 font-serif text-[var(--text-2xl)] font-semibold">Design system</h1>
        <p className="mx-auto mt-3 max-w-lg font-sans text-[var(--text-base)] text-[var(--color-ink-muted)]">
          Palette, type, the biblical-vocabulary primitive, capability
          matrix, and shell chrome — the foundation every workspace builds
          on.
        </p>
        <p className="mt-4 font-mono text-[var(--text-xs)] text-[var(--color-ink-faint)]">
          current breakpoint: <strong className="text-[var(--color-ink)]">{breakpoint}</strong> · viewport-driven, SSR-safe
        </p>
      </header>

      {/* Wordmark */}
      <Section eyebrow="Brand" title="Wordmark">
        <div className="flex flex-wrap items-end gap-10">
          <div className="flex flex-col items-center gap-2">
            <Wordmark size="sm" />
            <span className="font-mono text-[var(--text-xs)] text-[var(--color-ink-faint)]">sm</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Wordmark size="md" />
            <span className="font-mono text-[var(--text-xs)] text-[var(--color-ink-faint)]">md</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Wordmark size="lg" />
            <span className="font-mono text-[var(--text-xs)] text-[var(--color-ink-faint)]">lg</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Wordmark size="xl" />
            <span className="font-mono text-[var(--text-xs)] text-[var(--color-ink-faint)]">xl</span>
          </div>
        </div>
        <p className="mt-6 max-w-prose font-sans text-[var(--text-sm)] text-[var(--color-ink-muted)]">
          The dot on the “j” is a tittle, rendered as its own SVG element in{" "}
          <code className="rounded bg-[var(--color-bg-sunken)] px-1.5 py-0.5 font-mono text-[var(--text-xs)]">
            --color-rubric
          </code>{" "}
          — a scribal rubrication red — set against the letterforms in{" "}
          <code className="rounded bg-[var(--color-bg-sunken)] px-1.5 py-0.5 font-mono text-[var(--text-xs)]">
            --color-brand
          </code>
          , an oxidised bronze-verdigris. Matthew 5:18: “not one jot or one tittle.”
        </p>
        <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-6">
          <p className="mb-4 font-sans text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
            withVerse — for places with room: about panels, empty states
          </p>
          <Wordmark size="lg" withVerse />
        </div>
      </Section>

      {/* Palette */}
      <Section eyebrow="Foundation" title="Palette">
        <div className="grid gap-8 sm:grid-cols-2">
          {PALETTE_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 font-sans text-[var(--text-sm)] font-semibold text-[var(--color-ink-muted)]">
                {group.title}
              </h3>
              <div className="flex flex-wrap gap-3">
                {group.tokens.map((token) => (
                  <div key={token.varName} className="flex flex-col items-center gap-1.5">
                    <div
                      className="h-14 w-14 rounded-[var(--radius-md)] border border-[var(--color-border)]"
                      style={{ background: `var(${token.varName})`, boxShadow: "var(--shadow-sm)" }}
                    />
                    <span className="font-mono text-[var(--text-xs)] text-[var(--color-ink-faint)]">
                      {token.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Type scale */}
      <Section eyebrow="Foundation" title="Type scale">
        <div className="mb-10 space-y-3">
          {TYPE_SCALE.map((step) => (
            <div key={step} className="flex items-baseline gap-4 border-b border-[var(--color-border)] pb-2">
              <span className="w-14 shrink-0 font-mono text-[var(--text-xs)] text-[var(--color-ink-faint)]">
                {step}
              </span>
              <span className="font-sans text-[var(--color-ink)]" style={{ fontSize: `var(--text-${step})` }}>
                In the beginning God created
              </span>
            </div>
          ))}
        </div>
        <div className="container-passage rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-raised)] p-6 sm:p-8">
          <p className="mb-2 font-sans text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
            Scripture — Literata, capped at 68ch
          </p>
          <p className="prose-scripture text-[var(--color-ink)]">
            <sup className="mr-1 font-sans text-[var(--text-scripture-verse-num)] text-[var(--color-ink-faint)]">1</sup>
            In the beginning God created the heaven and the earth.{" "}
            <sup className="mr-1 font-sans text-[var(--text-scripture-verse-num)] text-[var(--color-ink-faint)]">2</sup>
            And the earth was without form, and void; and darkness was upon the
            face of the deep. And the Spirit of God moved upon the face of the
            waters. <sup className="mr-1 font-sans text-[var(--text-scripture-verse-num)] text-[var(--color-ink-faint)]">3</sup>
            And God said, <span style={{ background: "var(--color-highlight-amber)" }}>Let there be light</span>: and there was light.
          </p>
        </div>
      </Section>

      {/* GlossLabel */}
      <Section eyebrow="Primitive" title="GlossLabel — biblical vocabulary">
        <div className="mb-6 flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-4 py-3">
          <div>
            <p className="font-sans text-[var(--text-sm)] font-semibold">Plain labels</p>
            <p className="font-sans text-[var(--text-xs)] text-[var(--color-ink-faint)]">
              Swaps every term below for its English equivalent.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={plainLabels}
            onClick={togglePlainLabels}
            className={clsx(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              plainLabels ? "bg-[var(--color-brand-strong)]" : "bg-[var(--color-border-strong)]",
            )}
          >
            <span
              className={clsx(
                "absolute top-0.5 h-6 w-6 rounded-full bg-[var(--color-bg-raised)] transition-transform",
                plainLabels ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(lexicon) as LexiconId[]).map((id) => (
            <div key={id} className="border-b border-[var(--color-border)] pb-4">
              <GlossLabel id={id} as="strong" className="font-serif text-[var(--text-md)] font-semibold" />
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-prose font-sans text-[var(--text-sm)] text-[var(--color-ink-muted)]">
          Hover or focus a term above (desktop) to see the tooltip. On a
          touch device the gloss is a permanent italic subtitle instead —
          pure CSS, driven by <code className="font-mono text-[var(--text-xs)]">@media (hover: none)</code>,
          nothing measured in JS. Either way the gloss is wired into{" "}
          <code className="font-mono text-[var(--text-xs)]">aria-describedby</code>. A forced preview of the
          touch presentation:
        </p>
        <div className="mt-4 flex flex-wrap gap-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] p-5">
          {(["selah", "masora", "toledot"] as LexiconId[]).map((id) => (
            <div key={id}>
              <strong className="font-serif text-[var(--text-md)] font-semibold">{lexicon[id].term}</strong>
              <span className="block font-serif text-[var(--text-xs)] italic text-[var(--color-ink-faint)]">
                {lexicon[id].gloss}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Capability matrix */}
      <Section eyebrow="Responsiveness" title="Feature availability matrix">
        <p className="mb-6 max-w-prose font-sans text-[var(--text-sm)] text-[var(--color-ink-muted)]">
          Live output of <code className="font-mono text-[var(--text-xs)]">useCapability()</code> at the
          current breakpoint (<strong>{breakpoint}</strong>), next to the full matrix and the reasoning
          behind each cut.
        </p>
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <table className="w-full min-w-[720px] border-collapse text-left font-sans text-[var(--text-sm)]">
            <thead>
              <tr className="bg-[var(--color-bg-sunken)]">
                <th className="px-4 py-3 font-semibold">Feature</th>
                <th className="px-4 py-3 font-semibold">Now ({breakpoint})</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Tablet</th>
                <th className="px-4 py-3 font-semibold">Desktop</th>
                <th className="px-4 py-3 font-semibold">Why</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ORDER.map((feature) => {
                const row = CAPABILITY_MATRIX[feature];
                return (
                  <tr key={feature} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-3 font-medium">{feature}</td>
                    <td className="px-4 py-3">
                      <CurrentCapability feature={feature} />
                    </td>
                    <td className="px-4 py-3">
                      <CapabilityBadge level={row.phone} />
                    </td>
                    <td className="px-4 py-3">
                      <CapabilityBadge level={row.tablet} />
                    </td>
                    <td className="px-4 py-3">
                      <CapabilityBadge level={row.desktop} />
                    </td>
                    <td className="max-w-xs px-4 py-3 text-[var(--text-xs)] text-[var(--color-ink-faint)]">
                      {row.reason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Shell controls */}
      <Section eyebrow="Shell" title="Chrome controls">
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <p className="mb-2 font-sans text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
              Theme
            </p>
            <ThemeToggle />
          </div>
          <div>
            <p className="mb-2 font-sans text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
              Selah mode
            </p>
            <SelahToggle />
          </div>
          <div>
            <p className="mb-2 font-sans text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
              Bottom sheet
            </p>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex h-11 items-center rounded-[var(--radius-full)] border border-[var(--color-border)] px-4 font-sans text-[var(--text-sm)] font-medium hover:bg-[var(--color-surface-hover)]"
            >
              Open panel preview
            </button>
          </div>
        </div>
        <p className="mt-6 max-w-prose font-sans text-[var(--text-sm)] text-[var(--color-ink-muted)]">
          The nav itself is live above this page: resize the window to see
          it move between a bottom tab bar (&lt;768px), top tabs
          (768–1279px), and a left rail with a sidebar slot (≥1280px).
        </p>
      </Section>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Masora">
        <p className="font-serif text-[var(--text-sm)] italic text-[var(--color-ink-muted)]">
          {lexicon.masora.gloss}
        </p>
        <p className="mt-4 font-sans text-[var(--text-sm)] text-[var(--color-ink-muted)]">
          This is how a panel is presented below 768px — as a bottom sheet
          over the reader rather than a docked sidebar.
        </p>
      </BottomSheet>
    </div>
  );
}
