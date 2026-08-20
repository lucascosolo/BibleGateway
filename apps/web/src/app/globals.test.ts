// Gate on the design tokens in globals.css.
//
// Why this file exists: CSS fails open. A declaration whose value is invalid is discarded
// silently — no error, no warning, no console message — and the property falls back to its
// initial value. `--shadow-color` held `55 0.03 60` while every shadow template also supplied
// its own lightness, so each token resolved to `oklch(30% 55 0.03 60 / 0.08)`: four components
// where oklch takes three. Every shadow in the application was therefore `none`. Nothing looked
// *broken*; the app just had no elevation anywhere, and every dialog, popover and card read as
// painted flat onto the page behind it. It shipped that way and was found by eye, not by tooling.
//
// This is the same failure shape as the `next/font/google` trap in AGENTS.md — a build that
// succeeds while quietly producing something that does not work — so it gets the same treatment:
// an explicit assertion, because the absence of an error proves nothing.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CSS_PATH = path.resolve(import.meta.dirname, "globals.css");
const css = readFileSync(CSS_PATH, "utf8");

/** Every `--name: value` declaration, as name -> each distinct value it is given anywhere. */
function collectCustomProperties(source: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  // Values may span lines (the shadow tokens do), so match up to the terminating semicolon.
  const re = /(--[\w-]+)\s*:\s*([^;{}]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const [, name, rawValue] = m;
    const value = rawValue.replace(/\s+/g, " ").trim();
    const set = out.get(name) ?? new Set<string>();
    set.add(value);
    out.set(name, set);
  }
  return out;
}

const props = collectCustomProperties(css);

/**
 * Substitutes `var(--x)` using the given choice of value per property.
 *
 * A property can hold different values in the light block and each dark block, and a token is
 * only correct if it is valid under *every* combination — the original bug was present in all
 * three, but a variant that is malformed in dark mode alone is exactly as invisible.
 */
function expandOnce(value: string, pick: (name: string) => string | undefined): string {
  return value.replace(/var\((--[\w-]+)(?:\s*,[^)]*)?\)/g, (whole, name: string) => {
    const chosen = pick(name);
    return chosen ?? whole;
  });
}

function referencedVars(value: string): string[] {
  return [...value.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
}

/** Fully expands a value under one concrete assignment of values to the properties it uses. */
function expand(value: string, assignment: Map<string, string>): string {
  let current = value;
  for (let depth = 0; depth < 10; depth += 1) {
    const next = expandOnce(current, (n) => assignment.get(n));
    if (next === current) return next;
    current = next;
  }
  return current;
}

/** Every combination of theme-values for the properties a token transitively references. */
function assignments(value: string): Map<string, string>[] {
  const names = new Set<string>();
  const walk = (v: string, depth: number) => {
    if (depth > 6) return;
    for (const n of referencedVars(v)) {
      if (names.has(n)) continue;
      names.add(n);
      for (const inner of props.get(n) ?? []) walk(inner, depth + 1);
    }
  };
  walk(value, 0);

  let combos: Map<string, string>[] = [new Map()];
  for (const name of names) {
    const values = [...(props.get(name) ?? [])];
    if (values.length === 0) continue;
    const next: Map<string, string>[] = [];
    for (const combo of combos) {
      for (const v of values) {
        const copy = new Map(combo);
        copy.set(name, v);
        next.push(copy);
      }
    }
    // Guard against a combinatorial explosion if the token graph ever grows; the shadow tokens
    // reference four properties with two values each, so this cap is never reached today.
    combos = next.slice(0, 256);
  }
  return combos;
}

/** Extracts each `oklch(...)` call, respecting nested parentheses. */
function oklchCalls(value: string): string[] {
  const calls: string[] = [];
  const re = /oklch\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < value.length && depth > 0; i += 1) {
      if (value[i] === "(") depth += 1;
      else if (value[i] === ")") depth -= 1;
    }
    if (depth === 0) calls.push(value.slice(m.index + m[0].length, i - 1));
  }
  return calls;
}

/**
 * The three theme blocks, each as its own token map.
 *
 * `props` above deliberately collapses every declaration of a name into a set, because a token
 * must be *valid* under every theme. Contrast is the opposite kind of question: it is only
 * meaningful between two values that are actually on screen together, and pairing the light
 * ink with the dark accent would test a combination that never occurs. So this reads the blocks
 * separately, by brace depth from each block's opening line.
 */
function blockAt(start: number): Map<string, string> {
  const tokens = new Map<string, string>();
  let depth = 0;
  let i = css.indexOf("{", start);
  if (i === -1) return tokens;
  const from = i;
  depth = 1;
  i += 1;
  for (; i < css.length && depth > 0; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") depth -= 1;
  }
  const body = css.slice(from, i);
  const re = /(--[\w-]+)\s*:\s*([^;{}]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    tokens.set(m[1], m[2].replace(/\s+/g, " ").trim());
  }
  return tokens;
}

const themes = [
  { name: "light (:root)", tokens: blockAt(css.indexOf(":root {")) },
  {
    name: "dark (prefers-color-scheme)",
    tokens: blockAt(css.indexOf(':root:not([data-theme="light"])')),
  },
  { name: 'dark ([data-theme="dark"])', tokens: blockAt(css.indexOf(':root[data-theme="dark"]')) },
];

/** oklch -> linear sRGB. The standard Oklab matrices; no colour library in the test path. */
function oklchToSrgb(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** WCAG 2.1 relative luminance of a literal `oklch(L% C H)` value, or null if it is not one. */
function luminance(value: string): number | null {
  const m = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(value.trim());
  if (!m) return null;
  const rgb = oklchToSrgb(Number(m[1]) / 100, Number(m[2]), Number(m[3]));
  const [r, g, b] = rgb.map((c) => Math.min(1, Math.max(0, c)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe("globals.css design tokens", () => {
  it("declares shadow tokens that actually produce a shadow", () => {
    // The specific regression: assert the tokens exist AND that they survive expansion as valid
    // colours. A token that resolves to an invalid colour is indistinguishable from one that is
    // absent, so checking only for presence would have passed against the broken version.
    for (const token of ["--shadow-sm", "--shadow-md", "--shadow-lg"]) {
      expect(props.has(token), `${token} is not declared`).toBe(true);
    }
  });

  it("has no oklch() with a component count other than 3, under any theme", () => {
    const failures: string[] = [];

    for (const [name, values] of props) {
      for (const value of values) {
        if (!/oklch\(/i.test(value) && !/var\(/.test(value)) continue;

        for (const assignment of assignments(value)) {
          const expanded = expand(value, assignment);
          if (/var\(/.test(expanded)) continue; // references something defined outside this file
          if (!/oklch\(/i.test(expanded)) continue;

          for (const call of oklchCalls(expanded)) {
            const [coords] = call.split("/");
            const parts = coords.trim().split(/\s+/).filter(Boolean);
            if (parts.length !== 3) {
              failures.push(
                `${name}: oklch(${call.trim()}) has ${parts.length} components, expected 3 ` +
                  `(lightness chroma hue). CSS discards this declaration silently.`
              );
            }
          }
        }
      }
    }

    expect(failures.join("\n")).toBe("");
  });

  it("keeps every theme's dark blocks in lockstep", () => {
    // `@media (prefers-color-scheme: dark)` serves the reader who has never touched the theme
    // control; `[data-theme="dark"]` serves the one who has. They are the same theme, and a
    // token corrected in one and not the other is a bug visible to exactly half the audience.
    const [, mediaDark] = themes;
    const [, , attrDark] = themes;
    const disagreements: string[] = [];
    for (const [name, value] of mediaDark.tokens) {
      const other = attrDark.tokens.get(name);
      if (other !== undefined && other !== value) {
        disagreements.push(`${name}: media-query says "${value}", [data-theme] says "${other}"`);
      }
    }
    expect(disagreements.join("\n")).toBe("");
  });

  it("keeps ink legible on every accent surface, in every theme", () => {
    // The regression this pins: `--color-ink-on-accent` was near-white in BOTH themes, while
    // the accent tokens invert direction — "strong" is darker on parchment and lighter on a
    // dark ground. So in dark mode it was white text on a bright mint field: 1.70:1, against a
    // 4.5:1 requirement. It carried the cross-reference vote-weight badge, the home page's
    // search button, the roadmap button and the active theme pill, and it was found by a
    // reviewer measuring pixels rather than by anything in this repo.
    //
    // Contrast cannot be eyeballed and it cannot be inferred from a token's name. It is
    // arithmetic, so it is asserted.
    const SURFACES = ["--color-brand", "--color-brand-strong"];
    const failures: string[] = [];

    for (const theme of themes) {
      const ink = theme.tokens.get("--color-ink-on-accent");
      if (!ink) continue;
      for (const surface of SURFACES) {
        const bg = theme.tokens.get(surface);
        if (!bg) continue;
        const r = contrast(ink, bg);
        if (r === null) continue; // not a literal oklch() — nothing to measure
        if (r < 4.5) {
          failures.push(
            `${theme.name}: --color-ink-on-accent on ${surface} is ${r.toFixed(2)}:1, ` +
              `below the 4.5:1 minimum for normal text.`,
          );
        }
      }
    }

    expect(failures.join("\n")).toBe("");
  });

  it("keeps a lightness percentage on --shadow-color, in every theme", () => {
    // The original value was `55 0.03 60` — a bare 55 reads as a chroma of 55, not 55% lightness.
    const values = props.get("--shadow-color");
    expect(values, "--shadow-color is not declared").toBeDefined();
    for (const v of values!) {
      expect(v, `--shadow-color: ${v} — lightness must carry a % sign`).toMatch(/^\d+(\.\d+)?%\s/);
    }
  });
});
