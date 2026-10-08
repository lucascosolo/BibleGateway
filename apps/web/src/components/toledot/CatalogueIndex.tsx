"use client";

import { useEffect, useMemo, useState } from "react";

import { CatalogueRow, type CatalogueRowProps } from "@/components/toledot/CatalogueRow";
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
  const [state, setState] = useState<State>(INITIAL);
  const [wide, setWide] = useState(false);
  const [section, setSection] = useState<string | null>(null);

  useEffect(() => {
    const read = readLocation(chips.map((chip) => chip.key));
    setState(read.state);
    setSection(read.section);
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

  const update = (patch: Partial<State>) => {
    const next = { ...state, ...patch };
    setState(next);
    setSection(null);
    writeLocation(next);
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
    <div className="toledot-catalogue__index" data-kind={kind}>
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
        sections.map((group, index) => (
          <details
            key={`${state.sort}-${group.id}`}
            id={group.id}
            className="toledot-era"
            open={active || wide || index === 0 || section === group.id}
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
        ))
      )}
    </div>
  );
}
