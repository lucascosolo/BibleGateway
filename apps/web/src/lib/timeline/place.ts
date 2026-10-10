/**
 * The reader's place in a timeline view, kept per browser tab so that opening an entry and
 * coming back (Back, the tab bar, any link) lands where they left. A view is the /toledot strip
 * for one era, a catalogue page, or the compact strip on an entry page; each has its own key.
 *
 * sessionStorage can be absent or throw (private windows, blocked site data), so every access is
 * guarded and a missing place simply means the view opens at its default.
 */

export interface CatalogueView {
  sort: string;
  q: string;
  facets: Record<string, string>;
  /** Sections the reader opened or closed by hand, by section id; absent means the default. */
  open: Record<string, boolean>;
}

export interface Place {
  savedAt: number;
  /** The strip's horizontal scroll, the fallback when the opened entry is not in the view. */
  scrollLeft?: number;
  /** The window's vertical scroll on a catalogue, the same fallback. */
  scrollY?: number;
  /** The entry last opened from this view; restore anchors to it. */
  openedId?: string | null;
  /** That entry was opened from the keyboard, so Back returns focus to its link. */
  viaKeyboard?: boolean;
  view?: CatalogueView;
}

const PREFIX = "jot:timeline-place:v1:";
/** Older than this, a saved place describes a reading session that has ended. */
export const PLACE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readPlace(key: string, now = Date.now()): Place | null {
  try {
    const raw = storage()?.getItem(PREFIX + key);
    if (!raw) return null;
    const place = JSON.parse(raw) as Place;
    if (typeof place !== "object" || place === null || typeof place.savedAt !== "number") return null;
    if (now - place.savedAt > PLACE_MAX_AGE_MS || place.savedAt > now) return null;
    return place;
  } catch {
    return null;
  }
}

/** Merges `patch` into the saved place for `key`. */
export function savePlace(key: string, patch: Omit<Partial<Place>, "savedAt">, now = Date.now()): void {
  try {
    const next: Place = { ...readPlace(key, now), ...patch, savedAt: now };
    storage()?.setItem(PREFIX + key, JSON.stringify(next));
  } catch {
    // A place that cannot be kept is a convenience lost, not an error.
  }
}

/**
 * What a catalogue opens with. `fromUrl` is the view its fragment carries (null for none), and
 * `urlNamesSection` means the fragment names a section someone linked to. A fragment asking for
 * something other than the saved view is an explicit request and wins; one that matches it is
 * the catalogue's own record of that view (Back returns to it), so the saved view, with its
 * sections and last-opened entry, applies.
 */
export function chooseCatalogueView(
  fromUrl: Omit<CatalogueView, "open"> | null,
  urlNamesSection: boolean,
  saved: Place | null,
): CatalogueView | null {
  const view = saved?.view;
  if (!view || urlNamesSection) return null;
  if (fromUrl && !sameView(fromUrl, view)) return null;
  return view;
}

function sameView(a: Omit<CatalogueView, "open">, b: Omit<CatalogueView, "open">): boolean {
  const facets = (view: Omit<CatalogueView, "open">) =>
    JSON.stringify(Object.entries(view.facets).filter(([, value]) => value).sort());
  return a.sort === b.sort && a.q === b.q && facets(a) === facets(b);
}

/** The entry element with `data-entry-id` equal to `id` inside `root`, without building a selector from it. */
export function findEntry(root: ParentNode, id: string): HTMLElement | null {
  for (const node of root.querySelectorAll<HTMLElement>("[data-entry-id]")) if (node.dataset.entryId === id) return node;
  return null;
}

let lastPopAt = -Infinity;
let listening = false;

/** Starts noting history traversals so a view can tell it was reached by Back or Forward. */
export function listenForBack(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("popstate", () => {
    lastPopAt = performance.now();
  });
}

export function arrivedByBack(now = performance.now()): boolean {
  return now - lastPopAt < 3000;
}

const SETTLE_MS = 1500;
const USER_INPUT = ["pointerdown", "wheel", "touchstart", "keydown"] as const;

/**
 * Runs `apply` now and again while the page settles (fonts, images, client data and the router's
 * own scroll handling all move things after the first paint), until SETTLE_MS has passed or the
 * reader does anything. Input means they have taken over: a restore never fights them.
 * Returns a cancel function.
 */
export function settle(apply: () => void, observe?: Element | null): () => void {
  let done = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let observer: ResizeObserver | null = null;
  const run = () => {
    if (!done) apply();
  };
  const cancel = () => {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    observer?.disconnect();
    for (const type of USER_INPUT) window.removeEventListener(type, cancel, true);
    window.removeEventListener("load", run);
  };
  run();
  for (const type of USER_INPUT) window.addEventListener(type, cancel, { capture: true, passive: true });
  window.addEventListener("load", run);
  for (const ms of [16, 80, 250, 600, 1000]) timers.push(setTimeout(run, ms));
  timers.push(setTimeout(cancel, SETTLE_MS));
  try {
    void document.fonts?.ready.then(run);
  } catch {
    // No font loading API: the timed passes cover it.
  }
  if (observe && typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(run);
    observer.observe(observe);
  }
  return cancel;
}

/** Puts `node` in view vertically when it is not, near the top of the viewport. */
export function revealVertically(node: Element): void {
  const rect = node.getBoundingClientRect();
  const height = window.innerHeight;
  if (rect.top >= height * 0.1 && rect.bottom <= height * 0.9) return;
  window.scrollTo({ top: Math.max(0, rect.top + window.scrollY - height * 0.25), behavior: "instant" });
}

/** A brief, quiet mark on the entry the reader came back to. */
export function markReturned(node: HTMLElement): void {
  node.dataset.returned = "true";
  setTimeout(() => {
    delete node.dataset.returned;
  }, 3200);
}
