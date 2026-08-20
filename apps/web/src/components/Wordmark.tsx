import clsx from "clsx";

export type WordmarkSize = "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<WordmarkSize, string> = {
  sm: "1.25rem",
  md: "1.75rem",
  lg: "2.75rem",
  xl: "4.5rem",
};

interface WordmarkProps {
  size?: WordmarkSize;
  className?: string;
  /** Render the short "not one jot or one tittle" tagline beneath the mark. */
  withTagline?: boolean;
  /**
   * Render the full source verse beneath the mark, set as subordinate
   * typography (small caps, muted, clearly secondary to the mark itself).
   * For places with room to breathe — the /style page, an about panel, an
   * empty/landing state — never the nav, where it would just be noise.
   */
  withVerse?: boolean;
}

/**
 * The Jot wordmark. Hand-drawn as a monoline SVG logotype rather than live
 * text, specifically so the dot on the "j" can exist as its own element —
 * the tittle (Matt 5:18) — set in the second brand colour and never fused
 * with the letterform it sits above. Two brand colours: the stroke colour
 * (--color-brand, an oxidised-bronze verdigris) for the letters, and
 * --color-rubric (a scribal rubric red) for the tittle alone.
 */
export function Wordmark({
  size = "md",
  className,
  withTagline = false,
  withVerse = false,
}: WordmarkProps) {
  const height = SIZE_MAP[size];

  return (
    <span
      className={clsx("inline-flex flex-col", className)}
      style={{ ["--wordmark-size" as string]: height }}
    >
      <svg
        role="img"
        aria-label="Jot"
        viewBox="0 0 118 66"
        style={{ height: "var(--wordmark-size)", width: "auto" }}
        focusable="false"
      >
        <g
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* j — stem + descending hook, dotless by construction */}
          <path d="M20 20 V48 Q20 60 8 60 Q3 60 1 57" />
          {/* o */}
          <circle cx="54" cy="38" r="16" />
          {/* t — stem with foot + crossbar */}
          <path d="M96 8 V50 Q96 60 106 58" />
          <path d="M82 21 H110" />
        </g>
        {/* The tittle: a distinct element, in the second brand colour.
            It used to sit at cy=7 r=5.5, which put its top edge at y=1.5 — two and a half units
            ABOVE the top of the `t`'s ascender (y=8 less half of an 8-unit stroke, so y=4). A dot
            that overshoots the tallest letter in the word does not read as a tittle; it reads as
            a stray mark, which is what a reviewer called it. Now the dot's top aligns with the
            ascender line exactly (cy 9 − r 5 = 4) and it clears the stem below by 2 units, about
            a quarter of the stroke weight — the gap a drawn `j` actually has. */}
        <circle cx="20" cy="9" r="5" fill="var(--color-rubric)" />
      </svg>
      {withTagline ? (
        <span
          className="mt-1 font-serif italic text-[var(--text-xs)] text-[var(--color-ink-faint)]"
          aria-hidden="true"
        >
          not one jot or one tittle
        </span>
      ) : null}
      {withVerse ? (
        <p className="mt-2 max-w-[26ch] font-serif text-[var(--text-xs)] italic leading-[var(--leading-snug)] text-[var(--color-ink-faint)]">
          &ldquo;not one jot or one tittle shall pass from the law&rdquo;
          <br />
          <span
            className="not-italic font-sans"
            style={{ fontVariantCaps: "small-caps", letterSpacing: "0.04em" }}
          >
            — Matthew 5:18
          </span>
        </p>
      ) : null}
    </span>
  );
}
