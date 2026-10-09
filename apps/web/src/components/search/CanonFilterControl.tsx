"use client";

import { useId } from "react";

import type { CanonFilter } from "@/lib/search/query";

export interface CanonFilterControlProps {
  value: CanonFilter;
  onChange: (next: CanonFilter) => void;
}

/** Search covers the 66 books by default; this opts in to the outside books too. */
export function CanonFilterControl({ value, onChange }: CanonFilterControlProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        minHeight: "var(--touch-target)",
        paddingInline: "var(--space-3)",
        fontSize: "var(--text-xs)",
        color: "var(--color-ink-muted)",
        cursor: "pointer",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={value === "all"}
        onChange={(e) => onChange(e.target.checked ? "all" : "bible")}
        style={{ width: "1.125rem", height: "1.125rem", accentColor: "var(--color-brand)" }}
      />
      Include outside books
    </label>
  );
}
