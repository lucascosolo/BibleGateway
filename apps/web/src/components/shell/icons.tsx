interface IconProps {
  className?: string;
}

/** Small, custom line-icon set for the shell nav — no external icon library. */

export function BookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 5.5C4 4.67 4.67 4 5.5 4H11a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5H4Z" />
      <path d="M20 5.5c0-.83-.67-1.5-1.5-1.5H13a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5H20Z" />
    </svg>
  );
}

export function TimelineIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 12h16" />
      <circle cx="7" cy="12" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="13" cy="12" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.75" fill="currentColor" stroke="none" />
      <path d="M7 12V6M13 12V17M19 12V8" />
    </svg>
  );
}

export function ScrollIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 4h11a2 2 0 0 1 2 2v13a1.5 1.5 0 0 1-1.5 1.5H8" />
      <path d="M6 4a2 2 0 0 0-2 2v11.5A1.5 1.5 0 0 0 5.5 19H8V6a2 2 0 0 0-2-2Z" />
      <path d="M17.5 20.5a1.5 1.5 0 0 1-1.5-1.5V17" />
    </svg>
  );
}

export function MapIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.35-4.35" />
    </svg>
  );
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

export function MonitorIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16.5V20" />
    </svg>
  );
}

export function FeatherIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 4c-6 0-13 4-15 12l-1 4 4-1C16 17 20 10 20 4Z" />
      <path d="M13 11 5 19" />
    </svg>
  );
}

export function RoadmapIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 21V4.5a1 1 0 0 1 1.4-.9l1.2.5a1 1 0 0 0 .9 0l3-1.3a1 1 0 0 1 .9 0l3 1.3a1 1 0 0 0 .9 0l1.2-.5a1 1 0 0 1 1.4.9v9a1 1 0 0 1-1.4.9l-1.2-.5a1 1 0 0 0-.9 0l-3 1.3a1 1 0 0 1-.9 0l-3-1.3a1 1 0 0 0-.9 0L5 15" />
    </svg>
  );
}

export function LayersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m12 3 8.5 4.75L12 12.5 3.5 7.75Z" />
      <path d="m3.5 12 8.5 4.75L20.5 12" />
      <path d="m3.5 16.25 8.5 4.75 8.5-4.75" />
    </svg>
  );
}

/**
 * Lashon — the original languages.
 *
 * A root, not a letter. The first draft was an aleph, and it was wrong twice over: a drawn aleph
 * is a slanted stroke with two short arms, which at 20px is indistinguishable from a ✗ — an icon
 * that reads as "cancel" sitting in primary navigation. And a letter is the wrong idea anyway.
 * What this workspace does is take a word back to its root, which is what a Hebraist means by
 * shoresh: nearly every Hebrew word grows from a three-consonant root, and finding it is the
 * first move in reading the language. So: a stem with roots under it, which is the thing itself
 * rather than a decorative nod at the script.
 */
export function RootIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3v11" />
      <path d="M12 7.5c1.8 0 3-1.2 3.4-3" />
      <path d="M12 10c-1.8 0-3-1.2-3.4-3" />
      <path d="M12 14c-1.4 1.6-2 3.9-2 6.5" />
      <path d="M12 14c1.4 1.6 2 3.9 2 6.5" />
      <path d="M12 14c-2.6.9-4.6 2.4-5.8 4.4" />
      <path d="M12 14c2.6.9 4.6 2.4 5.8 4.4" />
    </svg>
  );
}

export function NotesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 4.5h14v15H5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export const WORKSPACE_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  book: BookIcon,
  root: RootIcon,
  timeline: TimelineIcon,
  scroll: ScrollIcon,
  map: MapIcon,
  search: SearchIcon,
  roadmap: RoadmapIcon,
  notes: NotesIcon,
};
