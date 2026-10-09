import clsx from "clsx";

export type WordmarkSize = "sm" | "md" | "lg" | "xl";

/**
 * The mark's geometry, shared with the share-card renderer (`app/og`), which cannot use CSS
 * custom properties and so draws it with resolved colours. One source, so the two cannot drift.
 *
 * Drawn in the icon's own units (the 512 tile of `public/icon.svg`) as filled brush outlines:
 * one pen, nib held at about 30 degrees, so verticals press thick and horizontals and lifts run
 * thin. `paths[0]` IS the icon's j, copied verbatim, so the icon and the wordmark are the same
 * stroke. The o and the t were swept by that pen along cubic centrelines (generator recorded in
 * docs/brand.md): x-height from the j's entry stroke (~178) to its baseline (~374), the t's
 * ascender topping out just above the tittle.
 */
export const WORDMARK_GEOMETRY = {
  viewBox: "180 48 548 384",
  width: 548,
  height: 384,
  /** j (from icon.svg), o (one closed loop: outer contour and counter, opposite winding), t (stem with foot, then crossbar). */
  paths: [
    "M 196 196 C 214 170, 262 156, 306 170 C 346 182, 360 220, 352 262 C 344 306, 340 342, 342 372 C 344 404, 318 426, 282 426 C 248 426, 214 410, 194 386 C 184 374, 190 358, 204 362 C 228 370, 256 380, 276 372 C 290 366, 294 352, 292 334 C 288 294, 284 254, 290 220 C 294 198, 282 186, 262 188 C 240 190, 222 198, 208 206 C 196 212, 188 206, 196 196 Z",
    "M 472 182 C 468 183, 464 185, 460 187 C 456 189, 453 192, 449 194 C 446 196, 442 198, 439 200 C 435 202, 432 204, 428 207 C 425 210, 421 213, 418 216 C 415 219, 412 223, 409 227 C 407 231, 404 235, 402 239 C 400 244, 398 249, 397 254 C 395 258, 394 264, 393 269 C 392 274, 392 280, 392 285 C 392 291, 393 297, 394 302 C 394 307, 396 313, 398 318 C 399 323, 401 328, 404 333 C 406 337, 409 342, 413 346 C 416 350, 419 354, 423 357 C 427 360, 431 363, 436 366 C 440 368, 445 370, 449 372 C 454 373, 459 374, 464 374 C 469 374, 474 374, 478 373 C 483 373, 488 371, 492 370 C 496 369, 500 367, 504 365 C 508 363, 511 360, 515 358 C 518 356, 522 354, 525 352 C 529 350, 532 348, 536 345 C 539 342, 543 339, 546 336 C 549 333, 552 329, 555 325 C 557 321, 560 317, 562 313 C 564 308, 566 303, 567 298 C 569 294, 570 288, 571 283 C 572 278, 572 272, 572 267 C 572 261, 571 255, 570 250 C 570 245, 568 239, 566 234 C 565 229, 563 224, 560 219 C 558 215, 555 210, 551 206 C 548 202, 545 198, 541 195 C 537 192, 533 189, 528 186 C 524 184, 519 182, 515 180 C 510 179, 505 178, 500 178 C 495 178, 490 178, 486 179 C 481 179, 476 181, 472 182 Z M 483 210 C 485 212, 487 213, 489 215 C 491 217, 493 218, 495 220 C 496 222, 498 224, 499 226 C 501 228, 502 230, 504 232 C 505 234, 507 236, 508 238 C 510 240, 511 243, 513 245 C 514 248, 515 250, 517 253 C 518 256, 519 259, 520 262 C 521 265, 522 268, 523 272 C 524 275, 525 278, 525 282 C 526 285, 526 289, 527 292 C 527 295, 527 299, 527 302 C 526 305, 526 309, 526 312 C 525 315, 524 318, 523 322 C 522 325, 521 328, 519 330 C 518 333, 516 336, 514 338 C 512 341, 510 343, 507 344 C 504 345, 501 346, 498 346 C 495 346, 492 346, 489 345 C 486 344, 484 343, 481 342 C 479 340, 477 339, 475 337 C 473 335, 471 334, 469 332 C 468 330, 466 328, 465 326 C 463 324, 462 322, 460 320 C 459 318, 457 316, 456 314 C 454 312, 453 309, 451 307 C 450 304, 449 302, 447 299 C 446 296, 445 293, 444 290 C 443 287, 442 284, 441 280 C 440 277, 439 274, 439 270 C 438 267, 438 263, 437 260 C 437 257, 437 253, 437 250 C 438 247, 438 243, 438 240 C 439 237, 440 234, 441 230 C 442 227, 443 224, 445 222 C 446 219, 448 216, 450 214 C 452 211, 454 209, 457 208 C 460 207, 463 206, 466 206 C 469 206, 472 206, 475 207 C 478 208, 480 209, 483 210 Z",
    "M 629 71 C 628 79, 630 94, 630 105 C 630 117, 629 129, 629 141 C 628 153, 628 165, 628 176 C 627 188, 627 200, 627 212 C 627 224, 627 236, 627 248 C 627 260, 627 271, 627 283 C 627 295, 627 308, 627 318 C 627 329, 626 338, 627 347 C 628 356, 628 364, 631 372 C 634 379, 638 387, 644 391 C 650 396, 659 398, 666 399 C 673 399, 679 396, 685 394 C 691 392, 695 389, 701 387 C 706 384, 715 380, 718 378 C 721 376, 720 377, 720 376 C 721 375, 721 373, 720 372 C 720 371, 719 370, 718 370 C 717 369, 718 369, 714 370 C 711 371, 702 375, 697 376 C 686 378, 678 362, 676 341 C 675 334, 674 327, 673 318 C 673 308, 673 295, 673 283 C 673 272, 673 260, 673 248 C 673 236, 674 224, 673 212 C 673 200, 672 188, 672 176 C 671 164, 670 152, 669 140 C 668 128, 666 116, 665 104 C 665 92, 664 77, 663 69 C 662 61, 660 60, 658 57 C 655 55, 649 53, 645 53 C 641 53, 636 56, 633 58 C 631 61, 630 63, 629 71 Z M 602 200 C 606 200, 613 198, 618 197 C 624 196, 630 196, 636 195 C 642 194, 648 193, 654 193 C 660 192, 666 191, 672 191 C 679 190, 685 190, 691 189 C 698 189, 706 189, 710 188 C 715 187, 716 187, 717 185 C 719 183, 720 180, 720 178 C 720 175, 719 172, 717 171 C 715 169, 714 168, 710 168 C 705 167, 697 168, 690 168 C 684 168, 677 169, 671 169 C 664 169, 658 170, 652 170 C 645 171, 639 171, 633 172 C 627 173, 621 173, 615 174 C 609 175, 602 175, 598 176 C 594 177, 592 178, 590 181 C 589 183, 588 187, 588 190 C 588 193, 590 196, 593 198 C 595 199, 598 200, 602 200 Z",
  ],
  /** The tittle (Matt 5:18): its own dot, never fused with the j. Same circle as the icon's. */
  tittle: { cx: 304, cy: 112, r: 31 },
  /** The app-icon tile the j sits on in `public/icon.svg`; its letter is `paths[0]`. */
  tile: { viewBox: "0 0 512 512", rx: 116, tittle: { cx: 304, cy: 112, r: 31 } },
} as const;

const SIZE_MAP: Record<WordmarkSize, string> = {
  sm: "1.25rem",
  md: "1.75rem",
  lg: "2.75rem",
  xl: "4.5rem",
};

interface WordmarkProps {
  size?: WordmarkSize;
  /**
   * "plain" is the word alone. "tile" is the lockup: the app-icon tile, then the word, drawn as
   * one image so it scales and reads as one mark.
   */
  variant?: "plain" | "tile";
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

const G = WORDMARK_GEOMETRY;
const [VB_X, VB_Y] = G.viewBox.split(" ").map(Number);
/** The tile is drawn at the word's height; the gap is a fifth of it. */
const TILE_SCALE = G.height / 512;
const TILE_GAP = 72;

function Letters() {
  return (
    <>
      {G.paths.map((d) => (
        <path key={d} d={d} fill="var(--color-brand)" />
      ))}
      {/* The tittle stays rubric on the page in both themes (5.6:1 light, 6.4:1 dark); on the
          green tile rubric falls to 1.1:1, so the tile carries it in parchment, as the icon does. */}
      <circle {...G.tittle} fill="var(--color-rubric)" />
    </>
  );
}

/**
 * The Jot wordmark, written in the icon's brush hand: one pen, thick where it presses and thin
 * where it lifts, with the tittle (Matt 5:18) as its own dot, never fused with the letter. The
 * letters take --color-brand and the tittle --color-rubric.
 */
export function Wordmark({
  size = "md",
  variant = "plain",
  className,
  withTagline = false,
  withVerse = false,
}: WordmarkProps) {
  const height = SIZE_MAP[size];
  const tiled = variant === "tile";
  const viewBox = tiled
    ? `0 0 ${G.height + TILE_GAP + G.width} ${G.height}`
    : G.viewBox;

  return (
    <span
      className={clsx("inline-flex flex-col", className)}
      style={{ ["--wordmark-size" as string]: height }}
    >
      <svg
        role="img"
        aria-label="Jot"
        viewBox={viewBox}
        style={{ height: "var(--wordmark-size)", width: "auto" }}
        focusable="false"
      >
        {tiled ? (
          <>
            <g transform={`scale(${TILE_SCALE})`}>
              <rect width="512" height="512" rx={G.tile.rx} fill="var(--color-tile)" />
              <circle {...G.tile.tittle} fill="var(--color-on-tile)" />
              <path d={G.paths[0]} fill="var(--color-on-tile)" />
            </g>
            <g transform={`translate(${G.height + TILE_GAP - VB_X} ${-VB_Y})`}>
              <Letters />
            </g>
          </>
        ) : (
          <Letters />
        )}
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
