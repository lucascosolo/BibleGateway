"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { CatalogueRow, type CatalogueRowProps } from "@/components/toledot/CatalogueRow";
import {
  arrivedByBack,
  chooseCatalogueView,
  findEntry,
  listenForBack,
  markReturned,
  readPlace,
  savePlace,
  settle,
  type Place,
} from "@/lib/timeline/place";
import { groupByBook, groupByEra, matchesQuery, sortByYear, type EraLike } from "@/lib/timeline/catalogue";
import { formatRange } from "@/lib/timeline/years";

export interface CatalogueItem extends CatalogueRowProps {
  id: string;
  year: number | null;
  book: number | null;
  searchText: string;
  facets: Record<string, string>;
}

export interface CatalogueChip {
  key: string;
  label: string;
  values: { value: string; label: string }[];
}

type Sort = "era" | "date" | "book";

const SORTS: { value: Sort; label: string }[] = [
  { value: "era", label: "By era" },
  { value: "date", label: "By date" },
  { value: "book", label: "By book" },
];

interface State {
  sort: Sort;
  q: string;
  facets: Record<string, string>;
}

const INITIAL: State = { sort: "era", q: "", facets: {} };

/** `#sort=book&q=paul` is view state; a bare `#roman` names a section to open and scroll to. */
function readLocation(chipKeys: string[]): { state: State; section: string | null } {
  try {
    const raw = window.location.hash.slice(1);
    if (!raw) return { state: INITIAL, section: null };
    if (!raw.includes("=")) return { state: INITIAL, section: decodeURIComponent(raw) };
    const params = new URLSearchParams(raw);
    const sort = params.get("sort");
    const facets: Record<string, string> = {};
    for (const key of chipKeys) {
      const value = params.get(key);
      if (value) facets[key] = value;
    }
    return {
      state: { sort: sort === "date" || sort === "book" ? sort : "era", q: params.get("q") ?? "", facets },
      section: null,
    };
  } catch {
    return { state: INITIAL, section: null };
  }
}

function writeLocation(state: State) {
  try {
    const params = new URLSearchParams();
    if (state.sort !== "era") params.set("sort", state.sort);
    if (state.q) params.set("q", state.q);
    for (const [key, value] of Object.entries(state.facets)) if (value) params.set(key, value);
    const { pathname, search } = window.location;
    const fragment = params.toString();
    window.history.replaceState(null, "", `${pathname}${search}${fragment ? `#${fragment}` : ""}`);
  } catch {
    // The fragment is a convenience; the view works without it.
  }
}

interface Props {
  kind: "events" | "people" | "issues";
  eras: EraLike[];
  books: [number, string][];
  items: CatalogueItem[];
  chips: CatalogueChip[];
  countNoun: string;
}

export function CatalogueIndex({ kind, eras, books, items, chips, countNoun }: Props) {
  const placeKey = `/toledot/${kind}`;
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>(INITIAL);
  const [wide, setWide] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  /** Sections the reader opened or closed by hand; the rest follow the default. */
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [restore, setRestore] = useState<Place | null>(null);
  const pendingSave = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    listenForBack();
    const read = readLocation(chips.map((chip) => chip.key));
    let fragment = false;
    try {
      fragment = window.location.hash.length > 1;
    } catch {
      // Treat the URL as carrying nothing.
    }
    const saved = readPlace(placeKey);
    const view = chooseCatalogueView(fragment && !read.section ? read.state : null, read.section !== null, saved);
    if (view) {
      setState({ sort: view.sort === "date" || view.sort === "book" ? view.sort : "era", q: view.q, facets: view.facets });
      setOpen(view.open);
      setRestore(saved);
    } else {
      setState(read.state);
      setSection(read.section);
    }
    try {
      setWide(window.matchMedia("(min-width: 64rem)").matches);
    } catch {
      // Keep the phone default.
    }
    // Read once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (section) document.getElementById(section)?.scrollIntoView();
  }, [section]);

  // Back on the page with a saved view: the row last opened goes near the top of the viewport,
  // or the saved scroll when that row is filtered out; re-applied while layout settles.
  useEffect(() => {
    const node = root.current;
    if (!restore || !node) return;
    const row = restore.openedId ? findEntry(node, restore.openedId) : null;
    const apply = () => {
      if (row) {
        const top = row.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.2;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      } else if (restore.scrollY !== undefined) {
        window.scrollTo({ top: restore.scrollY, behavior: "instant" });
      }
    };
    const cancel = settle(apply, node);
    if (row) {
      markReturned(row);
      if (restore.viaKeyboard && arrivedByBack()) row.querySelector("a")?.focus({ preventScroll: true });
    }
    return cancel;
  }, [restore]);

  // Once the reader scrolls the page themselves, where they scrolled to is the place.
  useEffect(() => {
    let moved = false;
    const onInput = () => {
      moved = true;
    };
    const onScroll = () => {
      if (!moved) return;
      clearTimeout(pendingSave.current);
      pendingSave.current = setTimeout(() => savePlace(placeKey, { scrollY: window.scrollY, openedId: null }), 200);
    };
    const inputs = ["wheel", "touchstart", "keydown"] as const;
    for (const type of inputs) window.addEventListener(type, onInput, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(pendingSave.current);
      for (const type of inputs) window.removeEventListener(type, onInput);
      window.removeEventListener("scroll", onScroll);
    };
  }, [placeKey]);

  const keepView = (next: State, nextOpen: Record<string, boolean>) =>
    savePlace(placeKey, { view: { ...next, open: nextOpen } });

  const update = (patch: Partial<State>) => {
    const next = { ...state, ...patch };
    setState(next);
    setSection(null);
    setRestore(null);
    writeLocation(next);
    keepView(next, open);
  };

  const toggled = (id: string, isOpen: boolean, byDefault: boolean) => {
    if ((open[id] ?? byDefault) === isOpen) return;
    const next = { ...open, [id]: isOpen };
    setOpen(next);
    keepView(state, next);
  };

  const opened = (click: MouseEvent<HTMLDivElement>) => {
    const link = (click.target as Element).closest("a");
    const id = link?.closest<HTMLElement>("[data-entry-id]")?.dataset.entryId;
    if (!id) return;
    clearTimeout(pendingSave.current);
    savePlace(placeKey, {
      view: { ...state, open },
      openedId: id,
      viaKeyboard: click.detail === 0,
      scrollY: window.scrollY,
    });
  };

  const bookNames = useMemo(() => new Map(books), [books]);
  const shown = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesQuery(state.q, item.searchText) &&
          Object.entries(state.facets).every(([key, value]) => !value || item.facets[key] === value),
      ),
    [items, state.q, state.facets],
  );
  const active = state.q.trim() !== "" || Object.values(state.facets).some(Boolean);

  const rows = (list: CatalogueItem[]) => (
    <ol className="toledot-rows">
      {list.map((item) => (
        <CatalogueRow
          key={item.id}
          entryId={item.id}
          href={item.href}
          title={item.title}
          when={item.when}
          gist={item.gist}
          marks={item.marks}
          evidence={item.evidence}
        />
      ))}
    </ol>
  );

  const sections: { id: string; name: string; span: string | null; items: CatalogueItem[] }[] =
    state.sort === "era"
      ? groupByEra(eras, shown, (item) => item.year).map((group) => ({
          id: group.era?.id ?? "undated",
          name: group.era?.name ?? "Not yet dated",
          span: group.era ? formatRange(group.era.start, group.era.end) : null,
          items: group.items,
        }))
      : state.sort === "book"
        ? groupByBook(shown, (item) => item.book, (book) => bookNames.get(book) ?? `Book ${book}`).map((group) => ({
            id: group.book === null ? "book-none" : `book-${group.book}`,
            name: group.name,
            span: null,
            items: group.items,
          }))
        : [];

  return (
    <div ref={root} className="toledot-catalogue__index" data-kind={kind} onClick={opened}>
      <div className="toledot-tools">
        <input
          type="search"
          className="toledot-filter__input"
          aria-label={`Filter ${countNoun}`}
          placeholder="Filter by name or word"
          value={state.q}
          onChange={(event) => update({ q: event.target.value })}
        />
        <div className="toledot-sort" role="radiogroup" aria-label="Sort by">
          {SORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={state.sort === option.value}
              className="toledot-sort__option"
              onClick={() => update({ sort: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="toledot-facets">
          {chips.map((chip) => {
            const selected = state.facets[chip.key] ?? "";
            const options = [{ value: "", label: "Any" }, ...chip.values];
            return (
              <div key={chip.key} role="group" aria-label={chip.label} className="toledot-facet">
                <span className="toledot-facet__label" aria-hidden="true">{chip.label}</span>
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected === option.value}
                    data-selected={selected === option.value}
                    className="toledot-chip"
                    onClick={() => update({ facets: { ...state.facets, [chip.key]: option.value } })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <p className="toledot-filter__count" aria-live="polite">
        {active ? `${shown.length} of ${items.length} ${countNoun}` : `${items.length} ${countNoun}`}
      </p>

      {shown.length === 0 ? (
        <p className="toledot-empty">
          No {countNoun} match &ldquo;{state.q}&rdquo;.
        </p>
      ) : state.sort === "date" ? (
        rows(sortByYear(shown, (item) => item.year))
      ) : (
        sections.map((group, index) => {
          const byDefault = active || wide || index === 0 || section === group.id;
          return (
          <details
            key={`${state.sort}-${group.id}`}
            id={group.id}
            className="toledot-era"
            open={open[group.id] ?? byDefault}
            onToggle={(toggle) => toggled(group.id, toggle.currentTarget.open, byDefault)}
          >
            <summary className="toledot-era__summary">
              <span className="toledot-era__name">{group.name}</span>
              {group.span && <span className="toledot-era__span">{group.span}</span>}
              <span className="toledot-era__count">
                {group.items.length} {countNoun}
              </span>
            </summary>
            {rows(group.items)}
          </details>
          );
        })
      )}
    </div>
  );
}
