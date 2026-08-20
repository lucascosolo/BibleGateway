/**
 * Accessibility gate for the rendered product, not just its JSX.
 *
 * Run on the VPS after the preview server is up:
 *   node scripts/a11y.mjs http://127.0.0.1:3987
 *
 * axe catches semantic/contrast/name failures a DOM smoke test cannot, while the focus pass
 * catches the keyboard failure that `aria-modal` alone cannot prevent.
 */
import { createRequire } from "node:module";

// Resolve from the web package, because this harness lives beside (not inside) its node_modules.
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { chromium } = require("playwright");
const axeSource = require("axe-core").source;
const BASE = process.argv[2] ?? "http://127.0.0.1:3987";
const ROUTES = [
  "/",
  "/read/John.3",
  "/read/John.5.4?t=BSB",
  "/parallel/John.3?a=WEB&b=BSB",
  "/notes",
  "/lashon/%CE%BB%CF%8C%CE%B3%CE%BF%CF%82",
  "/derash?q=covenant",
  "/api",
];

const browser = await chromium.launch();
const failures = [];

for (const viewport of [
  { width: 390, height: 844, name: "phone" },
  { width: 1280, height: 900, name: "desktop" },
]) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.width <= 768,
    isMobile: viewport.width <= 768,
    colorScheme: "light",
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "jot-preferences",
      JSON.stringify({ state: { theme: "light", tourSeen: true }, version: 2 }),
    );
  });
  const page = await context.newPage();

  for (const route of ROUTES) {
    try {
      const response = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45_000 });
      if (!response || response.status() >= 400) {
        failures.push(`${route} @${viewport.name}: HTTP ${response?.status() ?? "no response"}`);
        continue;
      }
      await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(500);
      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(async () =>
        window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } }),
      );
      for (const violation of result.violations) {
        failures.push(
          `${route} @${viewport.name}: ${violation.id} (${violation.nodes.length} node(s)) — ${violation.help}; ` +
            `targets: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
        );
      }

      // A modal must keep focus inside itself. A static aria-modal attribute is not enough.
      const opened = await page.evaluate(() => {
        const trigger = document.querySelector('[aria-haspopup="dialog"]');
        if (trigger instanceof HTMLElement) {
          trigger.click();
          return true;
        }
        return false;
      });
      if (opened) {
        for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
        const escaped = await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          return Boolean(dialog && !dialog.contains(document.activeElement));
        });
        if (escaped) failures.push(`${route} @${viewport.name}: keyboard focus escaped dialog`);
        await page.keyboard.press("Escape");
      }
    } catch (error) {
      failures.push(`${route} @${viewport.name}: ${error.message.split("\n")[0]}`);
    }
  }
  await context.close();
}

await browser.close();
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`a11y gate ok: axe WCAG A/AA + keyboard focus (${ROUTES.length} routes × 2 viewports)`);
}
