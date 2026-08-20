import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./reader.css";
import "./crossrefs.css";
import "./search.css";
import "./lashon.css";
import { ThemeScript } from "@/components/ThemeScript";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/shell/AppShell";

/**
 * Fonts are SELF-HOSTED, deliberately — do not "simplify" these back to `next/font/google`.
 *
 * `next/font/google` downloads the face at build time. The build machine has no outbound
 * access to fonts.gstatic.com, and Next does not fail the build when that fetch fails: it
 * emits the CSS variable but no `@font-face` at all, so every surface silently falls through
 * to a system font. The reader shipped in Arial for a while because of exactly this. Local
 * files make the typography a build artifact instead of a network gamble.
 *
 * These are the latin-subset variable faces (weight is an axis, so one file covers the whole
 * range). Total ~240KB, all `display: swap`.
 */
const literata = localFont({
  variable: "--font-literata",
  display: "swap",
  src: [
    { path: "./fonts/literata-normal.woff2", weight: "400 700", style: "normal" },
    { path: "./fonts/literata-italic.woff2", weight: "400 700", style: "italic" },
  ],
});

const archivo = localFont({
  variable: "--font-archivo",
  display: "swap",
  src: [{ path: "./fonts/archivo-normal.woff2", weight: "400 800", style: "normal" }],
});

/**
 * Pointed Hebrew, self-hosted for the same reason as the others — and for one more.
 *
 * The Westminster Leningrad Codex carries nikud (vowel points) AND te'amim (cantillation
 * accents), which stack above and below the consonant. Whether they land in the right place is
 * decided by the font's mark-positioning table, and most system defaults have none: the marks
 * pile up on top of each other, or drift onto the neighbouring letter, and the word becomes
 * unreadable to anyone who can actually read it. Before this file, the stack named four faces a
 * reader "might already have" — which meant the Hebrew looked correct on a scholar's own machine
 * and wrong on everyone else's, with no way to tell which you were seeing.
 *
 * Noto Serif Hebrew (SIL Open Font License 1.1 — redistributable, unlike SBL Hebrew, which is
 * free to install but not free to serve). This is the `hebrew` subset only, ~18KB, and it is
 * applied solely to original-language text; nothing else in the app is set in it.
 */
const notoSerifHebrew = localFont({
  // `--font-noto-hebrew`, not `--font-hebrew`: the latter is the design token in `globals.css`,
  // and both land on <html>, so a token defined as `var(--font-hebrew)` sourcing a next/font
  // variable of the same name is a self-reference — invalid at computed-value time, and silently
  // so. Same trap the `--jot-font-*` indirection exists to avoid.
  variable: "--font-noto-hebrew",
  display: "swap",
  src: [{ path: "./fonts/noto-serif-hebrew.woff2", weight: "400 700", style: "normal" }],
});

const jetbrainsMono = localFont({
  variable: "--font-jetbrains-mono",
  display: "swap",
  src: [{ path: "./fonts/jetbrains-mono-normal.woff2", weight: "400 500", style: "normal" }],
});

export const metadata: Metadata = {
  title: "Jot — scholarly Bible study",
  // Says what a reader gets, in words they already have. The previous description — "academic
  // apparatus fused with a fast, personal, deeply interactive reading surface" — described the
  // architecture to someone who had already read it.
  description:
    "Read the Bible closely: compare translations without losing your place, see which verses some Bibles leave out and why, follow cross-references, look up the Hebrew and Greek behind any word, or use the public research API.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variable classes go on <html>, NOT <body>. `globals.css` defines
    // `--jot-font-serif: var(--font-literata), …` on `:root`, and a custom property is
    // resolved at the element that declares it — with `--font-literata` defined only on
    // <body>, the `:root` declaration referenced an undefined variable, became invalid at
    // computed-value time, and every `font-family: var(--font-serif)` in the app silently
    // fell back to the browser default. The typefaces loaded correctly and were never used.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${literata.variable} ${archivo.variable} ${jetbrainsMono.variable} ${notoSerifHebrew.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
