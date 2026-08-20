/**
 * Layout measurement harness.
 *
 * Screenshots show that something looks wrong; they do not say what. This reports the numbers
 * that actually decide whether a reading surface is any good — the measure of the text column
 * in characters, whether the page scrolls sideways, whether the reading column is stranded in
 * dead space — at every breakpoint, so a layout regression is a failing number rather than an
 * argument about a picture.
 *
 *   node scripts/measure.mjs [baseUrl]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3987";

const WIDTHS = [320, 390, 768, 1024, 1280, 1536, 1920];
const ROUTES = ["/", "/read/John.3", "/read/Ps.23", "/derash?q=covenant", "/deep-dive/John.3.16"];

/**
 * Characters per line. The classic readable range for long-form prose is 45–85, but that is a
 * desktop standard: at 320 CSS px a serif large enough to read comfortably simply cannot fit
 * 45 characters, and shrinking the type to reach the number would make the page worse, not
 * better. Phones get their own floor.
 */
const MEASURE_MAX = 85;
const measureFloor = (viewportWidth) => (viewportWidth < 480 ? 28 : 45);

const browser = await chromium.launch();
const problems = [];

for (const width of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    hasTouch: width <= 768,
    isMobile: width <= 768,
  });
  const page = await context.newPage();

  for (const route of ROUTES) {
    let res;
    try {
      res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch (err) {
      problems.push(`${route} @${width}: navigation failed — ${err.message.split("\n")[0]}`);
      continue;
    }
    if (!res || res.status() >= 400) {
      problems.push(`${route} @${width}: HTTP ${res?.status()}`);
      continue;
    }
    await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);

    const m = await page.evaluate(() => {
      const doc = document.documentElement;
      const passage = document.querySelector(".passage");
      const body = document.body;

      // Characters per line, measured from the rendered font rather than assumed: build a
      // ruler span in the passage's own computed style and divide.
      let chars = null;
      let fontFamily = null;
      if (passage) {
        const cs = getComputedStyle(passage);
        fontFamily = cs.fontFamily;
        const ruler = document.createElement("span");
        ruler.style.font = cs.font || `${cs.fontSize} ${cs.fontFamily}`;
        ruler.style.position = "absolute";
        ruler.style.visibility = "hidden";
        ruler.style.whiteSpace = "pre";
        ruler.textContent = "abcdefghijklmnopqrstuvwxyz";
        document.body.appendChild(ruler);
        const perChar = ruler.getBoundingClientRect().width / 26;
        ruler.remove();
        chars = perChar > 0 ? Math.round(passage.getBoundingClientRect().width / perChar) : null;
      }

      // Any element wider than the viewport is what actually causes sideways scroll.
      const overflowing = [];
      if (doc.scrollWidth > doc.clientWidth + 1) {
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > doc.clientWidth + 1) {
            overflowing.push(
              `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}` +
                `(right=${Math.round(r.right)})`,
            );
            if (overflowing.length >= 3) break;
          }
        }
      }

      const rect = passage?.getBoundingClientRect();
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        overflowing,
        chars,
        fontFamily,
        passageLeft: rect ? Math.round(rect.left) : null,
        passageWidth: rect ? Math.round(rect.width) : null,
        // Dead space to the left of the reading column, excluding the nav rail.
        railWidth: Math.round(
          document.querySelector("[data-shell-rail], .shell__rail")?.getBoundingClientRect().width ?? 0,
        ),
        // The whole reading layout, text column plus apparatus panel. Centring has to be
        // judged on this, not on the text column alone — the panel legitimately occupies the
        // space to the right of the text, and measuring to the viewport edge calls a correct
        // two-column layout stranded.
        layout: (() => {
          const el = document.querySelector(".reader-layout");
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { left: Math.round(r.left), width: Math.round(r.width) };
        })(),
        bodyBg: getComputedStyle(body).backgroundColor,
      };
    });

    const label = `${route} @${width}`;
    if (m.scrollWidth > m.clientWidth + 1) {
      problems.push(`${label}: horizontal scroll (${m.scrollWidth} > ${m.clientWidth}) — ${m.overflowing.join(", ")}`);
    }
    // Only the reader is a long-form reading surface. A search-result preview or a card on
    // the home page is a snippet, and holding those to a prose measure would report noise.
    const floor = measureFloor(width);
    if (route.startsWith("/read") && m.chars !== null && (m.chars < floor || m.chars > MEASURE_MAX)) {
      problems.push(`${label}: measure is ${m.chars}ch, outside ${floor}–${MEASURE_MAX}`);
    }
    if (route.startsWith("/read") && m.layout) {
      // Stranded, not merely centred. A wide symmetric margin is a centred layout and is
      // fine; what reads as broken is the layout pinned to one side with a void beside it.
      const leftGutter = m.layout.left - m.railWidth;
      const rightGutter = m.clientWidth - (m.layout.left + m.layout.width);
      const lopsided = Math.abs(leftGutter - rightGutter) > 160;
      if (lopsided && Math.max(leftGutter, rightGutter) > 200) {
        problems.push(
          `${label}: reading layout is stranded — ${leftGutter}px left vs ${rightGutter}px right`,
        );
      }
    }
    if (m.fontFamily && !/Literata/i.test(m.fontFamily) && route.startsWith("/read")) {
      problems.push(`${label}: scripture is not rendering in Literata (got ${m.fontFamily})`);
    }

    console.log(
      `${label.padEnd(34)} measure=${String(m.chars ?? "-").padStart(3)}ch  ` +
        `passage=${String(m.passageWidth ?? "-").padStart(4)}px @x${String(m.passageLeft ?? "-").padStart(4)}  ` +
        `scroll=${m.scrollWidth}/${m.clientWidth}`,
    );
  }

  await context.close();
}

await browser.close();

if (problems.length) {
  console.log(`\n${problems.length} PROBLEMS:`);
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
} else {
  console.log("\nNo layout problems detected.");
}
