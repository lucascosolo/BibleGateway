/**
 * Screenshot harness for design review.
 *
 * Runs on the VPS against the preview server and captures every state a reviewer needs:
 * each route, at each breakpoint, in both themes. Output feeds the adversarial review, so
 * it must show the REAL rendered UI — not mockups, not partial viewports.
 *
 *   node scripts/shoot.mjs [outDir] [baseUrl]
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = process.argv[2] ?? "/srv/scratch/jot/shots";
const BASE = process.argv[3] ?? "http://127.0.0.1:3987";

const WIDTHS = [
  { w: 320, h: 900, name: "320" },   // small Android
  { w: 390, h: 900, name: "390" },   // iPhone
  { w: 768, h: 1024, name: "768" },  // tablet
  { w: 1280, h: 900, name: "1280" }, // laptop
  { w: 1920, h: 1200, name: "1920" }, // desktop
];

const ROUTES = [
  { path: "/api", name: "api-docs" },
  { path: "/", name: "home" },
  { path: "/read", name: "read-index" },
  { path: "/read/John.3", name: "reader-john3" },
  { path: "/parallel/John.3?a=WEB&b=BSB", name: "parallel-john3" },
  { path: "/notes", name: "notes-index" },
  { path: "/read/Ps.23", name: "reader-ps23" },
  { path: "/read/Isa.53?t=BSB", name: "reader-isa53-bsb" },
  // Mark 9 in BSB is the omitted-verse apparatus in situ: v.44 and v.46 are not printed by
  // translations following the critical text, and the reader has to explain the gap.
  { path: "/read/Mark.9?t=BSB", name: "reader-mark9-omissions" },
  // A whole-book reference now lands on a chapter chooser rather than streaming 2,461 verses
  // as one column with restarting verse numbers.
  { path: "/read/Ps", name: "reader-psalms-index" },
  // The single omitted verse, in the translation that omits it: apparatus, not a 404.
  { path: "/read/John.5.4?t=BSB", name: "reader-john5-4-bsb" },
  { path: "/read/John.3-5", name: "reader-multichapter" },
  { path: "/derash?q=covenant", name: "derash-results" },
  { path: "/derash", name: "derash-empty" },
  { path: "/deep-dive/John.3.16", name: "deepdive-john316" },
  { path: "/lashon", name: "lashon-index" },
  { path: "/lashon/H2617a", name: "lashon-hesed" },
  // A bare Strong's number that names two different words: the disambiguation, not a 404.
  { path: "/lashon/H2617", name: "lashon-disambiguation" },
  { path: "/lashon/%CE%BB%CF%8C%CE%B3%CE%BF%CF%82", name: "lashon-logos" },
  // The seven-translation switcher, and the two texts most likely to expose it: the KJV's
  // Jacobean English beside a 1901 revision, and a Jewish translation of the Hebrew Bible
  // whose absent New Testament must read as a scope note rather than as a broken page.
  { path: "/read/Ps.23?t=KJV", name: "reader-ps23-kjv" },
  { path: "/read/Gen.1?t=ASV", name: "reader-gen1-asv" },
  { path: "/read/Isa.53?t=JPS", name: "reader-isa53-jps" },
  { path: "/read/John.3?t=JPS", name: "reader-john3-jps-out-of-scope" },
  { path: "/read/Ps.23?t=YLT", name: "reader-ps23-ylt" },
  // The same omitted verse in the translation that PRINTS it — the pair is the argument.
  { path: "/read/Acts.8.37?t=BSB", name: "reader-acts8-37-bsb-omitted" },
  { path: "/read/Acts.8.37?t=KJV", name: "reader-acts8-37-kjv-printed" },
  { path: "/roadmap", name: "roadmap-index" },
  { path: "/toledot", name: "roadmap-toledot" },
  { path: "/geniza", name: "roadmap-geniza" },
  { path: "/massaot", name: "roadmap-massaot" },
  { path: "/style", name: "style" },
];

const THEMES = ["light", "dark"];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
let count = 0;
const failures = [];

for (const theme of THEMES) {
  for (const size of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: size.w, height: size.h },
      deviceScaleFactor: 1,
      colorScheme: theme,
      // Touch-capable for the mobile widths, so any pointer-based UI takes its touch path.
      hasTouch: size.w <= 768,
      isMobile: size.w <= 768,
    });
    // Persist the theme the app itself stores, so the toggle state matches the OS hint.
    //
    // `tourSeen: true` is not decoration. The guided tour opens by itself on a first visit, and
    // a fresh browser context IS a first visit — without this every one of these screenshots is
    // a picture of the tour dialog with the page greyed out behind it.
    //
    // `version` must match `PREFERENCES_VERSION` in lib/store/preferences.ts. At 0 the store
    // runs its migrations over this object on every load, which is not the state a reader is in.
    await context.addInitScript((t) => {
      localStorage.setItem(
        "jot-preferences",
        JSON.stringify({ state: { theme: t, tourSeen: true }, version: 2 }),
      );
    }, theme);

    const page = await context.newPage();
    for (const route of ROUTES) {
      const file = `${OUT}/${route.name}-${size.name}-${theme}.png`;
      try {
        // `networkidle` is the wrong signal here: the cross-reference panel fetches after
        // hydration, and on a 2-core box that window never goes quiet inside the timeout.
        // Wait for the document, then give the client panels a fixed settle period.
        const res = await page.goto(BASE + route.path, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        if (!res || res.status() >= 400) {
          failures.push(`${route.path} @${size.name}/${theme} -> HTTP ${res?.status()}`);
          continue;
        }
        await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await page.screenshot({ path: file, fullPage: false });
        count++;
      } catch (err) {
        failures.push(`${route.path} @${size.name}/${theme} -> ${err.message.split("\n")[0]}`);
      }
    }
    await context.close();
  }
}

/**
 * Second pass: the reading layers that are OFF by default.
 *
 * The interlinear is the largest thing in this build and nobody sees it unless they switch it
 * on, so a screenshot set that only shows defaults would show a reviewer everything except the
 * feature most worth reviewing. Hebrew and Greek both, because they are different code paths —
 * the row direction is per-language and getting it wrong renders every Hebrew verse backwards.
 */
const LAYER_ROUTES = [
  { path: "/read/Gen.1", name: "interlinear-hebrew" },
  { path: "/read/John.1", name: "interlinear-greek" },
  { path: "/read/Ps.51", name: "interlinear-psalm51" },
  // Daniel 2 is ARAMAIC, and it is a third code path rather than a variation on the Hebrew one:
  // the stem letters are shared with Hebrew and mean different things, so this is the page where
  // a decoder using the wrong table says "qal" where the answer is "peal". Daniel 1 is Hebrew
  // and Daniel 2:4 switches mid-verse, which is also why the language is recorded per word.
  { path: "/read/Dan.2", name: "interlinear-aramaic" },
  // Pointed Hebrew at its densest: an acrostic with full cantillation, where a font without a
  // mark-positioning table piles the accents on top of the vowels.
  { path: "/read/Ps.119", name: "interlinear-psalm119-pointing" },
];

for (const theme of THEMES) {
  for (const size of [{ w: 390, h: 900, name: "390" }, { w: 1280, h: 900, name: "1280" }]) {
    const context = await browser.newContext({
      viewport: { width: size.w, height: size.h },
      deviceScaleFactor: 1,
      colorScheme: theme,
      hasTouch: size.w <= 768,
      isMobile: size.w <= 768,
    });
    await context.addInitScript((t) => {
      localStorage.setItem(
        "jot-preferences",
        JSON.stringify({
          state: {
            theme: t,
            tourSeen: true,
            layers: {
              verseNumbers: true, highlights: true, notes: true, crossRefs: true,
              heat: false, variants: true, sourceCrit: false, interlinear: true,
            },
          },
          version: 2,
        }),
      );
    }, theme);
    const page = await context.newPage();
    for (const route of LAYER_ROUTES) {
      const file = `${OUT}/${route.name}-${size.name}-${theme}.png`;
      try {
        const res = await page.goto(BASE + route.path, { waitUntil: "domcontentloaded", timeout: 45000 });
        if (!res || res.status() >= 400) {
          failures.push(`${route.path} @${size.name}/${theme} -> HTTP ${res?.status()}`);
          continue;
        }
        await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await page.screenshot({ path: file, fullPage: false });
        count++;
      } catch (err) {
        failures.push(`${route.path} @${size.name}/${theme} -> ${err.message.split("\n")[0]}`);
      }
    }
    await context.close();
  }
}

/**
 * Third pass: the states that only exist because someone did something.
 *
 * Every shot above is a URL. But three of the review's findings were about UI that no URL
 * reaches — the guided tour that opens on a first visit, the reading-settings panel, and the
 * toolbar that appears when you select a verse. A screenshot set made only of routes is
 * systematically blind to exactly the surfaces a reviewer is most likely to call cluttered,
 * because they are the ones that appear ON TOP of the reading column.
 *
 * 1180×694 is deliberate and is not a device: it is the window the design reviewer actually
 * used, and it is where the settings panel was found clipped with no scroll affordance. A
 * harness that only shoots 900px-tall viewports cannot reproduce a short-window bug.
 */
const INTERACTIONS = [
  {
    name: "tour-welcome",
    path: "/",
    // The one context that does NOT pre-set `tourSeen`, so the dialog opens by itself exactly
    // as it does for a first-time visitor.
    firstRun: true,
    async act() {},
  },
  {
    name: "tour-setup",
    path: "/",
    firstRun: true,
    // Walk to the settings step. Clicking "Next" by name rather than counting steps, so adding
    // a step to the tour does not silently start screenshotting the wrong card.
    async act(page) {
      for (let i = 0; i < 12; i++) {
        const heading = await page.locator('[role="dialog"] h2').first().textContent();
        if (heading && heading.startsWith("Set it up")) return;
        await page.getByRole("button", { name: "Next" }).click();
        await page.waitForTimeout(200);
      }
      throw new Error("never reached the setup step");
    },
  },
  {
    name: "layers-panel-open",
    path: "/read/John.3",
    async act(page) {
      await page.getByRole("button", { name: /Pardes|Reading layers/ }).first().click();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "selection-toolbar",
    path: "/read/John.3",
    // Select a verse mid-column, which is the case where the toolbar used to cover the line
    // above the selection.
    async act(page) {
      await page.evaluate(() => {
        const verse = document.querySelectorAll(".verse")[6];
        if (!verse) throw new Error("no verse to select");
        const range = document.createRange();
        range.selectNodeContents(verse);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
        document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });
      await page.waitForTimeout(600);
    },
  },
  {
    name: "command-palette",
    path: "/read/John.3",
    async act(page) {
      await page.keyboard.press("Meta+K");
      await page.waitForTimeout(300);
    },
  },
];

for (const theme of THEMES) {
  for (const size of [
    { w: 390, h: 844, name: "390" },
    { w: 1180, h: 694, name: "1180x694" },
    { w: 1280, h: 900, name: "1280" },
  ]) {
    for (const item of INTERACTIONS) {
      const context = await browser.newContext({
        viewport: { width: size.w, height: size.h },
        deviceScaleFactor: 1,
        colorScheme: theme,
        hasTouch: size.w <= 768,
        isMobile: size.w <= 768,
      });
      await context.addInitScript(
        ([t, firstRun]) => {
          localStorage.setItem(
            "jot-preferences",
            JSON.stringify({ state: { theme: t, tourSeen: !firstRun }, version: 2 }),
          );
        },
        [theme, item.firstRun ?? false],
      );
      const page = await context.newPage();
      const file = `${OUT}/${item.name}-${size.name}-${theme}.png`;
      try {
        const res = await page.goto(BASE + item.path, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        if (!res || res.status() >= 400) {
          failures.push(`${item.name} @${size.name}/${theme} -> HTTP ${res?.status()}`);
        } else {
          await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
          await page.waitForTimeout(1200);
          await item.act(page);
          await page.screenshot({ path: file, fullPage: false });
          count++;
        }
      } catch (err) {
        failures.push(`${item.name} @${size.name}/${theme} -> ${err.message.split("\n")[0]}`);
      }
      await context.close();
    }
  }
}

await browser.close();
console.log(`captured ${count} screenshots to ${OUT}`);
if (failures.length) {
  console.log(`\n${failures.length} FAILURES:`);
  for (const f of failures) console.log("  " + f);
  process.exitCode = 1;
}
