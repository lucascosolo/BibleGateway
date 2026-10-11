/**
 * The arrow that ends a card, a pager link or a "see all" link.
 *
 * It used to be a bare "→" glyph. On a phone or tablet a glyph the size of a letter reads as
 * decoration, and the user taps at it, misses, and taps again (2026-10-10). `ArrowSquare` draws
 * the arrow inside a bordered square the size of a touch target, so the pressable thing looks
 * pressable. It is still decorative: the parent link or button is the control, carries the
 * accessible name, and is what the square sits inside. Never make the square itself the control.
 *
 * `ArrowIcon` is the bare glyph as an SVG, for pills that are already obviously buttons.
 */

type Direction = "right" | "left";

export function ArrowIcon({ direction = "right", className }: { direction?: Direction; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 20 20"
      width="1.1em"
      height="1.1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={direction === "left" ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M3.5 10h13M11 4.5 16.5 10 11 15.5" />
    </svg>
  );
}

export function ArrowSquare({
  direction = "right",
  size = "md",
  className,
}: {
  direction?: Direction;
  /** `md` is a full 44px touch target, for cards and pagers; `sm` sits inside a line of text. */
  size?: "md" | "sm";
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={["arrow-square", size === "sm" ? "arrow-square--sm" : "", className ?? ""].join(" ").trim()}>
      <ArrowIcon direction={direction} />
    </span>
  );
}
