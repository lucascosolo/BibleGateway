"use client";

import { useId, useRef, useState } from "react";
import clsx from "clsx";
import { usePreferencesStore, type LayerToggles } from "@/lib/store/preferences";
import { getLexiconEntry, glossFor } from "@/lib/lexicon";
import { useBreakpoint } from "@/lib/capability";
import { BottomSheet } from "./BottomSheet";
import { AnchoredPanel } from "./AnchoredPanel";
import { LayersIcon } from "./icons";
import { ThemeToggle } from "./ThemeToggle";
import { TourLauncher } from "@/components/onboarding/TourLauncher";

/**
 * The production control for `toggleLayer` (ARCHITECTURE.md §4.6 "Pardes"), for Selah, and for
 * the global "Plain labels" preference.
 *
 * Both existed only in the preferences store / the `/style` dev page before this — a reader had
 * no way to turn cross-references, heat, or variants on or off, and no way to reach "Plain
 * labels" outside a page that ships to production but was never meant as the settings surface.
 *
 * ONE body (`LayerSheetBody`), TWO presentations, chosen by `<LayerSurface>` and nothing else.
 * Below 768px it is a `<BottomSheet>`; at 768px and up it is an `<AnchoredPanel>` pinned to the
 * trigger. A bottom sheet at every breakpoint was the first shape and it was wrong on a desktop
 * for a measurable reason: a full-bleed row at 1366px puts each switch about 1300px from the
 * label it belongs to, so associating the two stops being one glance. The body is deliberately
 * not forked — there are three triggers for it already, and a second copy is how the phone and
 * the desktop start disagreeing about which layers exist.
 *
 * `sourceCrit` is deliberately not exposed here: nothing renders differently when it flips
 * (the source-criticism layer has no data yet — Phase 4, ARCHITECTURE.md §6) and a toggle with
 * no visible effect is exactly the kind of undisclosed non-functioning control this pass exists
 * to remove, not add.
 *
 * Every row below is held to that same standard, and two of them failed it until recently:
 * `crossRefs` and `variants` were rendered here and read by nothing. Each description now
 * names what the switch actually changes on screen, so a reader can check the claim. Before
 * adding a row, flip it and find the pixels that move.
 */

export interface LayerRowSpec {
  key: keyof LayerToggles;
  label: string;
  description: string;
}

/**
 * Descriptions are a function of "Plain labels", not constants.
 *
 * The parenthetical lexicon terms are exactly what that preference exists to replace, so
 * hardcoding them made the toggle a half-measure: the nav said "Reading layers" while the sheet
 * it opened still said Masora and Testimonia.
 */
export function layerRows(plainLabels: boolean): LayerRowSpec[] {
  const term = (t: string) => (plainLabels ? "" : ` (${t})`);
  return [
    { key: "verseNumbers", label: "Verse numbers", description: "The small number before each verse." },
    { key: "highlights", label: "Highlights", description: "Your saved highlight colours." },
    // No parenthetical on these two, and it is not an oversight.
    //
    // They used to read "(Masora)" and "(Testimonia)", and both were wrong. The Masora is the
    // Masoretic scribal apparatus of the Hebrew Bible — it is not your personal marginalia.
    // Testimonia are collected proof-texts assembled to argue something — they are not a
    // vote-weighted cross-reference index. A reviewer caught both, and was right that a reader
    // who knows the words will re-evaluate everything else on the page after seeing them
    // misused. A technical term used decoratively costs more credibility than it buys.
    { key: "notes", label: "Notes", description: "Notes you've attached to a verse." },
    {
      key: "insights",
      label: "Insights",
      description: "Small windows into the original text — a wordplay, a custom, a connection you might not have seen.",
    },
    {
      key: "crossRefs",
      label: "Cross-references",
      description: "The panel of linked passages beside the text.",
    },
    { key: "heat", label: "Reference heat", description: "Tint showing how often a verse is quoted elsewhere." },
    {
      // One switch, two genuinely different kinds of evidence — so the sentence names both, and
      // the Hebrew term is attached ONLY to the half it actually describes. Qere/Kethiv is a
      // specifically Masoretic notation in the Hebrew Bible; the previous wording let it trail a
      // clause about Greek New Testament verses, which is a category error.
      key: "variants",
      label: "Variant readings",
      description: `The readings the Hebrew scribes marked in the margin${term(
        "Qere/Kethiv",
      )}, and why a verse other Bibles print is missing from this one.`,
    },
    {
      // The interlinear had a preference, a renderer and a default, and no switch — so the one
      // layer a researcher is most likely to come here for could not be turned on at all. It is
      // last in the list because it is the heaviest thing on the page by a distance.
      key: "interlinear",
      label: "Original language",
      description: `Hebrew or Greek under each verse, word by word${term("Lashon")}.`,
    },
  ];
}

/**
 * The single place the presentation is chosen. Both branches portal to <body> and both run
 * `useModalSurface`, so focus trap, background inerting, focus restore and Escape are identical
 * either way — the only thing that varies is where the box is.
 *
 * `useBreakpoint` rather than a CSS `md:` class, and rather than trusting which chrome mounted
 * this: rendering both and hiding one with CSS would mount the body twice, which is the
 * duplicate-state bug `<CrossRefPanel>` already paid for. It is SSR-safe (see lib/capability.ts)
 * — server and first client paint both assume phone, then it corrects after mount.
 */
function LayerSurface({
  open,
  onClose,
  title,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const breakpoint = useBreakpoint();

  if (breakpoint === "phone") {
    return (
      <BottomSheet open={open} onClose={onClose} title={title}>
        <LayerSheetBody />
      </BottomSheet>
    );
  }
  return (
    <AnchoredPanel open={open} onClose={onClose} title={title} anchorRef={anchorRef}>
      <LayerSheetBody />
    </AnchoredPanel>
  );
}

/**
 * The rail / top-tabs trigger: a labeled pill matching `<SelahToggle>`, and stacked in the rail
 * for the same reason it is — 5.75rem does not fit "Reading layers" on one line.
 *
 * `compact` used to drop the label here too, which left the 1280px rail showing a bare hexagon
 * above a bare feather. It now only drops the gloss's permanent second line.
 */
export function LayerControls({
  className,
  compact = false,
  layout = "inline",
}: {
  className?: string;
  compact?: boolean;
  layout?: "inline" | "stack";
}) {
  const [open, setOpen] = useState(false);
  const plainLabels = usePreferencesStore((s) => s.plainLabels);
  const entry = getLexiconEntry("pardes");
  const label = plainLabels ? entry.plainLabel : entry.term;
  const descId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const stacked = layout === "stack";

  return (
    <span className={clsx("relative inline-flex flex-col", stacked && "w-full")}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={descId}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "border border-[var(--color-border)] bg-transparent font-sans font-medium text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-hover)]",
          stacked
            ? "flex min-h-[var(--touch-target)] w-full flex-col items-center gap-1 rounded-[var(--radius-lg)] px-1 py-2 text-center text-[0.6875rem] leading-tight break-words hyphens-auto"
            : "inline-flex h-11 items-center gap-2 rounded-[var(--radius-full)] px-3.5 text-[var(--text-sm)]",
          className,
        )}
      >
        <LayersIcon className={stacked ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0"} />
        <span className={stacked ? "w-full" : undefined}>{label}</span>
      </button>
      <span id={descId} className={clsx("gloss-subtitle", compact && "gloss-subtitle--compact")}>
        {entry.gloss}
      </span>

      <LayerSurface open={open} onClose={() => setOpen(false)} title={label} anchorRef={triggerRef} />
    </span>
  );
}

/**
 * The bottom-tab-bar trigger: matches the other four workspace cells (icon over a compact
 * label) rather than the pill button above, since it sits in that row, not beside it.
 */
export function LayerControlsTab() {
  const [open, setOpen] = useState(false);
  const plainLabels = usePreferencesStore((s) => s.plainLabels);
  const entry = getLexiconEntry("pardes");
  const label = plainLabels ? entry.plainLabel : entry.term;
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-[10px] leading-tight font-medium text-[var(--color-ink-faint)]"
      >
        <LayersIcon className="h-5 w-5 shrink-0" />
        <span className="w-full truncate text-center">{label}</span>
      </button>
      <LayerSurface open={open} onClose={() => setOpen(false)} title={label} anchorRef={triggerRef} />
    </>
  );
}

function LayerSheetBody() {
  const layers = usePreferencesStore((s) => s.layers);
  const toggleLayer = usePreferencesStore((s) => s.toggleLayer);
  const plainLabels = usePreferencesStore((s) => s.plainLabels);
  const togglePlainLabels = usePreferencesStore((s) => s.togglePlainLabels);
  const selahMode = usePreferencesStore((s) => s.selahMode);
  const toggleSelahMode = usePreferencesStore((s) => s.toggleSelahMode);
  const pardes = getLexiconEntry("pardes");
  const selah = getLexiconEntry("selah");
  const selahLabel = plainLabels ? selah.plainLabel : selah.term;

  return (
    <div className="flex flex-col gap-4">
      {/* This used to open with a `<fieldset>` whose `<legend>` read "READING LAYERS" directly
          under a dialog titled "Pardes" — and "Reading layers" is *literally* what the Plain
          labels preference renames Pardes to, so with that preference on the panel said the
          same three words twice, six pixels apart. The heading stays in the dialog title; what
          sits here now is the gloss, which says something the title does not. Sourced from the
          lexicon, never retyped — an inline copy is a copy free to drift (AGENTS.md). */}
      <p className="font-serif text-[var(--text-xs)] italic text-[var(--color-ink-faint)]">
        {glossFor(pardes, plainLabels)}
      </p>

      {/* Selah lives in this panel and not only in the chrome, because the chrome it lives in
          does not exist below 768px: the bottom tab bar has no Selah cell, so on a phone the
          only control that overrides every switch below was unreachable — while the panel
          cheerfully explained that it was on. It is boxed rather than listed as a seventh row
          because it is not a layer; it is the master switch over all six. */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] px-3 py-1">
        <LayerRow
          label={selahLabel}
          description={glossFor(selah, plainLabels)}
          checked={selahMode}
          onChange={toggleSelahMode}
        />
        {selahMode && (
          <p className="pb-2 font-sans text-[var(--text-xs)] text-[var(--color-ink-muted)]">
            Every layer below is hidden right now regardless of its switch — including the
            cross-reference panel beside the passage. Turning {selahLabel} off brings back
            whatever is switched on.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
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

      <div className="border-t border-[var(--color-border)] pt-1">
        <LayerRow
          label="Plain labels"
          // Names words that are actually still on screen. It used to advertise Masora and
          // Testimonia, which have been removed — a control describing what it does to terms
          // that no longer exist is a small lie about a preference whose whole job is honesty.
          description="Swaps Selah, Pardes, Lashon and the rest for ordinary English."
          checked={plainLabels}
          onChange={togglePlainLabels}
        />
      </div>

      {/* Theme and the guided tour live here for the same reason Selah does: this panel is the
          only reading-settings surface that exists at EVERY breakpoint.
          A review found both missing below 1280px. The theme control had never existed on a
          phone at all — it sits in the ≥768px top bar, and the bottom tab bar has no cell for
          it — so a reader on a phone in a bright room could not switch to light. "Guide" was
          worse: it lives in the ≥1280px rail and on the home page, which means the only way
          back to the tour for a tablet or phone user was the one page a returning visitor does
          not visit.
          One row, not two stacked settings blocks: the panel is already the tallest thing in
          the shell, and the review also found it overflowing its box at 1180×694. */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
        <ThemeToggle />
        <TourLauncher variant="link" />
      </div>
    </div>
  );
}

export function LayerRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  // The whole row is the switch (not a label wrapping a nested button) — a `<label>` only
  // forwards clicks to a labelable form control, and a `role="switch"` button is not one, so
  // wrapping it would silently make everything left of the visual switch unclickable.
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex min-h-[var(--touch-target)] w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-1 py-2 text-start hover:bg-[var(--color-surface-hover)]"
    >
      <span className="min-w-0">
        <span className="block font-sans text-[var(--text-sm)] text-[var(--color-ink)]">{label}</span>
        {/* `leading-snug` rather than the inherited body leading. Seven of these rows now stack
            in a 22rem panel, and at normal leading a two-line description makes every row ~100px
            tall, which is what pushed the panel past the height of the screen. */}
        <span className="block font-sans text-[var(--text-xs)] leading-snug text-[var(--color-ink-faint)]">
          {description}
        </span>
      </span>
      <SwitchTrack checked={checked} />
    </button>
  );
}

export function SwitchTrack({ checked }: { checked: boolean }) {
  return (
    <span
      className={clsx(
        "relative inline-block h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-[var(--color-brand)]" : "bg-[var(--color-border-strong)]",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-6 w-6 rounded-full bg-[var(--color-bg-raised)] transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </span>
  );
}
