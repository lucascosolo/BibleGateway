import { readFileSync } from "node:fs";
import path from "node:path";

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import type { ReactNode } from "react";

import { WORDMARK_GEOMETRY } from "@/components/Wordmark";
import { getCorpusBuildId } from "@/lib/db/client";
import { getTranslationByCode } from "@/lib/db/corpus";
import { CARD_HEIGHT, CARD_WIDTH, SITE_URL, cardVersion, excerpt, type ShareCard } from "@/lib/seo";

import {
  crossReferenceCount,
  familySnapshot,
  licenceLine,
  pageCardCopy,
  parseCard,
  passageSnapshot,
  wordSnapshot,
} from "./data";

/**
 * `/og` — the preview card for any shared Jot link (1200×630 PNG).
 *
 * A route handler rather than per-segment `opengraph-image.tsx` files because those never see
 * the query string, and the translation IS a query parameter: a shared `?t=KJV` link would
 * otherwise unfurl with the WEB text.
 *
 * This draws a QUOTATION of a passage for a link preview — a picture, with no layers, no
 * annotations and no interaction. It is not a reading surface and must never grow into one;
 * anything a reader can act on belongs to `PassageRenderer`.
 */

/**
 * Colours are the light-theme tokens from `globals.css`, converted from oklch to sRGB because
 * the card renderer has no CSS custom properties and no oklch. Derived with the standard OKLab
 * matrices (Björn Ottosson) — re-derive rather than eyeball if a token changes:
 *   --color-bg          oklch(97.5% 0.012 78)  → #fbf6ee
 *   --color-bg-sunken   oklch(94.5% 0.016 75)  → #f3ece1
 *   --color-ink         oklch(24% 0.02 55)     → #271d16
 *   --color-ink-muted   oklch(42% 0.021 55)    → #574a42
 *   --color-ink-faint   oklch(50% 0.018 55)    → #6c615a
 *   --color-border      oklch(85% 0.017 70)    → #d5ccc2
 *   --color-brand       oklch(46% 0.075 185)   → #14655d
 *   --color-brand-strong oklch(32% 0.078 185)  → #003f38
 *   --color-rubric      oklch(52% 0.19 32)     → #be260b
 * A preview is shown on whatever background the host app chooses, so the card carries its own
 * page colour and is drawn in the light theme only.
 */
const C = {
  bg: "#fbf6ee",
  sunken: "#f3ece1",
  ink: "#271d16",
  muted: "#574a42",
  faint: "#6c615a",
  border: "#d5ccc2",
  brand: "#14655d",
  brandStrong: "#003f38",
  rubric: "#be260b",
};

/**
 * Static cuts of the app's own faces (Fontsource builds of the same OFL families as
 * `app/fonts/`). The renderer reads TTF/OTF/WOFF only — not WOFF2 — and draws only the default
 * instance of a variable font, so the app's variable WOFF2 files cannot be reused here.
 */
const FONT_DIR = path.join(process.cwd(), "src", "app", "og", "fonts");
const font = (file: string) => readFileSync(path.join(FONT_DIR, file));
type FontList = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>;
let fonts: FontList | undefined;
function loadFonts(): FontList {
  fonts ??= [
    { name: "Literata", data: font("literata-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Literata", data: font("literata-latin-400-italic.woff"), weight: 400, style: "italic" },
    { name: "Literata", data: font("literata-latin-600-normal.woff"), weight: 600, style: "normal" },
    // Each subset under its OWN family name: the renderer picks one face per family and falls
    // back across the family list per glyph, so subsets sharing "Literata" were never reached
    // and Greek drew as empty boxes.
    { name: "Literata Ext", data: font("literata-latin-ext-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Literata Ext", data: font("literata-latin-ext-400-italic.woff"), weight: 400, style: "italic" },
    { name: "Literata Greek", data: font("literata-greek-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Literata Greek Ext", data: font("literata-greek-ext-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Archivo", data: font("archivo-latin-600-normal.woff"), weight: 600, style: "normal" },
    { name: "Noto Serif Hebrew", data: font("noto-serif-hebrew-hebrew-500-normal.woff"), weight: 500, style: "normal" },
  ];
  return fonts;
}

const SERIF = "Literata, Literata Ext, Literata Greek, Literata Greek Ext, Noto Serif Hebrew";
const SANS = "Archivo";

function Wordmark({ height }: { height: number }) {
  const g = WORDMARK_GEOMETRY;
  return (
    <svg width={(height * g.width) / g.height} height={height} viewBox={g.viewBox}>
      {g.paths.map((d) => (
        <path key={d} d={d} fill="none" stroke={C.brand} strokeWidth={g.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <circle {...g.bowl} fill="none" stroke={C.brand} strokeWidth={g.strokeWidth} />
      <circle {...g.tittle} fill={C.rubric} />
    </svg>
  );
}

/** The folio every card shares: kicker and mark above, address and attribution below. */
function Frame({ kicker, footer, children }: { kicker: string; footer?: string; children: ReactNode }) {
  return (
    <div
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        display: "flex",
        flexDirection: "column",
        background: C.bg,
        color: C.ink,
        fontFamily: SERIF,
        padding: "58px 84px 46px 104px",
        position: "relative",
      }}
    >
      {/* The rubricated margin rule of a manuscript page: the one red line on the card. */}
      <div style={{ position: "absolute", left: 64, top: 58, bottom: 46, width: 3, background: C.rubric, display: "flex" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            fontFamily: SANS,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: C.brandStrong,
          }}
        >
          {kicker}
        </div>
        <Wordmark height={46} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", minHeight: 0 }}>
        {children}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `1.5px solid ${C.border}`,
          paddingTop: 20,
          fontFamily: SANS,
          fontSize: 20,
          fontWeight: 600,
          color: C.faint,
        }}
      >
        <div style={{ display: "flex", color: C.brand }}>{new URL(SITE_URL).host}</div>
        {footer ? <div style={{ display: "flex" }}>{footer}</div> : null}
      </div>
    </div>
  );
}

function Title({ children, size = 72 }: { children: ReactNode; size?: number }) {
  return (
    <div style={{ display: "flex", fontSize: size, fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.01em", color: C.ink }}>
      {children}
    </div>
  );
}

/** Bigger type for a short verse, smaller for a long one; the excerpt bounds the worst case. */
function quoteSize(length: number): number {
  if (length <= 80) return 50;
  if (length <= 150) return 42;
  if (length <= 220) return 36;
  return 32;
}

/**
 * Hebrew for a renderer with no bidi algorithm and no mark positioning.
 *
 * Shown CONSONANTAL, as a Torah scroll writes it. The renderer draws combining marks as
 * free-standing glyphs beside the word rather than on their letters, so pointed text comes out
 * with its vowels and accents in a heap — the unreadable-Hebrew failure `layout.tsx` documents
 * for system fonts. Dropping the points is a real written form; misplacing them is not. The
 * transliteration beside it carries the vocalisation, and the pointed headword travels in
 * `og:title`, which the host app shapes properly. Then reversed into visual order.
 */
function cardHebrew(text: string): string {
  if (!/[֐-׿]/.test(text)) return text;
  const consonantal = text.replace(/[֑-ׇ]/g, "");
  return [...consonantal].reverse().join("");
}

function passageCard(ref: string, code: string) {
  const snapshot = passageSnapshot(ref, code);
  if (!snapshot) return null;
  const joined = snapshot.verses.map((v) => v.text).join(" ");
  const quote = excerpt(joined, 260);
  return (
    <Frame kicker={snapshot.translation.name} footer={`${snapshot.translation.code} · ${licenceLine(snapshot.translation)}`}>
      <Title size={snapshot.label.length > 22 ? 60 : 72}>{snapshot.label}</Title>
      <div
        style={{
          display: "flex",
          marginTop: 28,
          fontSize: quoteSize(quote.length),
          lineHeight: 1.42,
          color: C.ink,
          maxWidth: 980,
        }}
      >
        {`“${quote}”`}
      </div>
    </Frame>
  );
}

function parallelCard(ref: string, a: string, b: string) {
  const left = passageSnapshot(ref, a, 2);
  const right = passageSnapshot(ref, b, 2);
  if (!left && !right) return null;
  const label = (left ?? right)!.label;
  const column = (snapshot: typeof left, code: string) => {
    const name = snapshot?.translation.code ?? getTranslationByCode(code)?.code ?? code;
    return (
      <div style={{ display: "flex", flexDirection: "column", width: 470 }}>
        <div style={{ display: "flex", fontFamily: SANS, fontSize: 20, fontWeight: 600, letterSpacing: "0.12em", color: C.brand }}>{name}</div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 30, lineHeight: 1.4, color: snapshot ? C.ink : C.faint, fontStyle: snapshot ? "normal" : "italic" }}>
          {snapshot ? `“${excerpt(snapshot.verses.map((v) => v.text).join(" "), 150)}”` : "Not printed in this translation."}
        </div>
      </div>
    );
  };
  return (
    <Frame kicker="Parallel · Two translations side by side" footer="Aligned by canonical verse">
      <Title size={64}>{label}</Title>
      <div style={{ display: "flex", marginTop: 30, justifyContent: "space-between" }}>
        {column(left, a)}
        <div style={{ display: "flex", width: 1.5, background: C.border }} />
        {column(right, b)}
      </div>
    </Frame>
  );
}

function networkCard(ref: string, code: string) {
  const snapshot = passageSnapshot(ref, code, 2);
  if (!snapshot) return null;
  const count = crossReferenceCount(snapshot.range);
  return (
    <Frame kicker="Testimonia · Cross-references" footer="OpenBible.info cross-reference data">
      <Title size={snapshot.label.length > 22 ? 60 : 72}>{snapshot.label}</Title>
      <div style={{ display: "flex", alignItems: "baseline", marginTop: 22, fontFamily: SANS, fontWeight: 600, color: C.brandStrong }}>
        <div style={{ display: "flex", fontSize: 64 }}>{count.toLocaleString("en-US")}</div>
        <div style={{ display: "flex", fontSize: 28, marginLeft: 16, color: C.muted }}>
          {count === 1 ? "linked passage" : "linked passages"}
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 18, fontSize: 30, lineHeight: 1.4, color: C.muted, fontStyle: "italic" }}>
        {`“${excerpt(snapshot.verses.map((v) => v.text).join(" "), 140)}”`}
      </div>
    </Frame>
  );
}

const LANGUAGE_NAMES: Record<string, string> = { hbo: "Biblical Hebrew", arc: "Biblical Aramaic", grc: "Koine Greek" };

function wordCard(key: string) {
  const family = familySnapshot(key);
  if (family) {
    return (
      <Frame kicker="Lashon · Original language" footer="Strong’s concordance">
        <Title size={84}>{`Strong’s ${family.base}`}</Title>
        <div style={{ display: "flex", marginTop: 24, fontSize: 36, color: C.muted }}>
          {`${family.members} distinct biblical words share this number.`}
        </div>
      </Frame>
    );
  }
  const word = wordSnapshot(key);
  if (!word) return null;
  const stats = [
    word.strongs,
    LANGUAGE_NAMES[word.language] ?? word.language,
    `${word.total.toLocaleString("en-US")} ${word.total === 1 ? "occurrence" : "occurrences"}`,
    `${word.bookCount} ${word.bookCount === 1 ? "book" : "books"}`,
  ].filter(Boolean);
  return (
    <Frame kicker="Lashon · Original language" footer="Concordance with attributed dictionary entries">
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
        <div style={{ display: "flex", fontSize: 112, lineHeight: 1.25, color: C.ink }}>{cardHebrew(word.headword)}</div>
        {word.xlit ? (
          <div style={{ display: "flex", marginLeft: 36, fontSize: 44, fontStyle: "italic", color: C.muted }}>{word.xlit}</div>
        ) : null}
      </div>
      {word.gloss ? (
        <div style={{ display: "flex", marginTop: 8, fontSize: 46, color: C.ink }}>{`“${excerpt(word.gloss, 60)}”`}</div>
      ) : null}
      <div style={{ display: "flex", marginTop: 26, fontFamily: SANS, fontSize: 24, fontWeight: 600, letterSpacing: "0.04em", color: C.brandStrong }}>
        {stats.join("  ·  ")}
      </div>
    </Frame>
  );
}

function pageCard(page: Parameters<typeof pageCardCopy>[0], query?: string) {
  const copy = pageCardCopy(page, query);
  return (
    <Frame kicker={copy.kicker} footer={page === "home" ? "“not one jot or one tittle” — Matthew 5:18" : undefined}>
      <Title size={copy.title.length > 30 ? 64 : 76}>{copy.title}</Title>
      <div style={{ display: "flex", marginTop: 26, fontSize: 34, lineHeight: 1.4, color: C.muted, maxWidth: 960 }}>{copy.body}</div>
    </Frame>
  );
}

function draw(card: ShareCard) {
  switch (card.kind) {
    case "page":
      return pageCard(card.page, card.query);
    case "passage":
      return passageCard(card.ref, card.t);
    case "parallel":
      return parallelCard(card.ref, card.a, card.b);
    case "network":
      return networkCard(card.ref, card.t);
    case "word":
      return wordCard(card.key);
  }
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const card = parseCard(params);
  // A card that cannot be resolved still gets an image: the site card. A broken image in an
  // unfurl reads as a broken site; the generic card is true of every page.
  const element = (card && draw(card)) ?? pageCard("home");
  // `immutable` only when the URL names the current design and corpus; a stale or missing `v`
  // gets a short lifetime so it cannot pin an old card (AGENTS.md: immutable needs a version).
  const current = params.get("v") === cardVersion(getCorpusBuildId());
  return new ImageResponse(element, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: loadFonts(),
    headers: {
      "Cache-Control": current
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300, s-maxage=300",
    },
  });
}
