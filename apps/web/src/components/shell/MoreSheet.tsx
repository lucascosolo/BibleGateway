"use client";

import Link from "next/link";
import clsx from "clsx";
import { BottomSheet } from "./BottomSheet";
import { WORKSPACES, PLANNED_WORKSPACES, COLLAPSED_WORKSPACE_KEYS, type Workspace } from "./workspaces";
import { HeartIcon, LayersIcon, QuestionIcon, RoadmapIcon, TranslationsIcon, WORKSPACE_ICONS } from "./icons";
import { PlannedMarker, plannedSrText } from "./PlannedMarker";
import { SUPPORT_URL } from "@/lib/support";
import { getLexiconEntry, type LexiconId } from "@/lib/lexicon";
import { usePreferencesStore } from "@/lib/store/preferences";
import { useTourStore } from "@/lib/store/tour";

type Icon = (props: { className?: string }) => React.JSX.Element;

interface Row {
  key: string;
  icon: Icon;
  plainLabel: string;
  lexiconId?: LexiconId;
  href?: string;
  onSelect?: () => void;
  planned?: boolean;
  phase?: number;
}

const workspaceRow = (ws: Workspace): Row => ({
  key: ws.key,
  icon: WORKSPACE_ICONS[ws.icon],
  plainLabel: ws.plainLabel,
  lexiconId: ws.lexiconId,
  href: ws.href,
  planned: ws.status === "planned",
  phase: ws.phase,
});

/**
 * Everything the five-cell phone bar does not carry. It is a `<BottomSheet>`, so the modal
 * contract (trap, inert, restore, Escape) comes from the one shared hook. Pardes does not open
 * on top of this sheet: the row closes this sheet and asks the bar to open the layer sheet, so
 * there is only ever one modal and focus restores to the More button either way.
 */
export function MoreSheet({
  open,
  onClose,
  active,
  onOpenLayers,
}: {
  open: boolean;
  onClose: () => void;
  active: Workspace["key"];
  onOpenLayers: () => void;
}) {
  const openTour = useTourStore((s) => s.openTour);
  const rows: Row[] = [
    ...WORKSPACES.filter((ws) => COLLAPSED_WORKSPACE_KEYS.has(ws.key)).map(workspaceRow),
    { key: "pardes", icon: LayersIcon, plainLabel: "Reading layers", lexiconId: "pardes", onSelect: onOpenLayers },
    { key: "guide", icon: QuestionIcon, plainLabel: "Guide", onSelect: () => openTour() },
    { key: "translations", icon: TranslationsIcon, plainLabel: "Translations", href: "/translations" },
    ...(SUPPORT_URL ? [{ key: "support", icon: HeartIcon, plainLabel: "Support", href: "/support" }] : []),
    { key: "roadmap", icon: RoadmapIcon, plainLabel: "Roadmap", href: "/roadmap" },
    ...PLANNED_WORKSPACES.map(workspaceRow),
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title="More">
      <ul className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <li key={row.key}>
            <MoreRow row={row} current={row.key === active} onClose={onClose} />
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

function MoreRow({ row, current, onClose }: { row: Row; current: boolean; onClose: () => void }) {
  const plainLabels = usePreferencesStore((s) => s.plainLabels);
  const entry = row.lexiconId ? getLexiconEntry(row.lexiconId) : null;
  const Icon = row.icon;
  const className = clsx(
    "flex min-h-[var(--touch-target)] w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left font-sans text-[var(--text-sm)]",
    current
      ? "bg-[var(--color-brand-soft)] font-semibold text-[var(--color-brand-strong)]"
      : "text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]",
  );
  const body = (
    <>
      <span className="relative flex shrink-0">
        <Icon className="h-5 w-5" />
        {row.planned && <PlannedMarker />}
      </span>
      {entry && !plainLabels ? (
        // The gloss is visible text inside the row, so it is part of the accessible name too.
        <span className="flex min-w-0 flex-col">
          <span>{entry.term}</span>
          <span className="text-[var(--text-xs)] font-normal italic text-[var(--color-ink-muted)]">{entry.gloss}</span>
        </span>
      ) : (
        <span>{entry ? entry.plainLabel : row.plainLabel}</span>
      )}
      {row.planned && <span className="sr-only">{plannedSrText(row.phase)}</span>}
    </>
  );

  if (row.href) {
    return (
      <Link href={row.href} aria-current={current ? "page" : undefined} onClick={onClose} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        row.onSelect?.();
      }}
      className={className}
    >
      {body}
    </button>
  );
}
