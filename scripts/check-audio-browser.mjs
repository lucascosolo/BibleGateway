/** Real Chromium media smoke test. Run against an isolated preview with the audio snapshot.
 * node scripts/check-audio-browser.mjs http://127.0.0.1:3988
 * Required recordings: WEB John 4/5 and Genesis 1; Hebrew Genesis 1.
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:3988";
const db = new Database(process.env.AUDIO_DB_PATH ?? fileURLToPath(new URL("../data/audio.db", import.meta.url)), { readonly: true });
const selectedTiming = db.prepare(`SELECT v.start_ms FROM audio_verses v
  JOIN audio_editions e USING(edition_id) WHERE e.code='WEB-williams' AND v.verse_id=43004011`).get();
assert(selectedTiming, "snapshot must include WEB John 4:11");
db.close();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() => {
  if (!localStorage.getItem("jot-preferences")) {
    localStorage.setItem("jot-preferences", JSON.stringify({ version: 3, state: { tourSeen: true, plainLabels: true } }));
  }
});
const main = () => page.locator("audio").nth(0);
const clip = () => page.locator("audio").nth(1);
const report = (check, extra = {}) => console.log(JSON.stringify({ check, passed: true, ...extra }));
async function progressing() {
  const before = await main().evaluate((el) => el.currentTime);
  await page.waitForFunction((time) => {
    const el = document.querySelector("audio");
    return el && !el.paused && el.currentTime > time + 0.3;
  }, before);
}
async function openReader(ref) {
  const response = await page.goto(`${base}/read/${ref}?t=WEB`, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  await page.locator("button.reader__listen").waitFor();
}
try {
  await openReader("John.4");
  await page.locator("button.reader__listen").click();
  await progressing();
  assert.match(await main().getAttribute("src"), /WEB-williams\/43-004\.m4a/);
  report("WEB playback advances");

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("audio").paused);
  const pausedAt = await main().evaluate((el) => el.currentTime);
  await page.waitForTimeout(400);
  assert(Math.abs((await main().evaluate((el) => el.currentTime)) - pausedAt) < 0.05);
  report("pause holds position");

  await page.locator('.reader [data-verse-id="43004011"]').first().evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.locator("button.reader__listen").click();
  await progressing();
  const selectedAt = await main().evaluate((el) => el.currentTime);
  assert(Math.abs(selectedAt - selectedTiming.start_ms / 1000) < 3, `selected verse sought to ${selectedAt}s`);
  report("selected verse seeks to John 4:11", { seconds: selectedAt });
  await page.evaluate(() => window.getSelection().removeAllRanges());

  // Let a real ended event drive navigation, rather than dispatching a synthetic event.
  await main().evaluate((el) => { el.dataset.smokeIdentity = "persistent"; el.currentTime = el.duration - 0.35; });
  await page.waitForURL(/\/read\/John\.5\?t=WEB/, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector("audio")?.src.includes("43-005.m4a"));
  assert.equal(await main().getAttribute("data-smoke-identity"), "persistent");
  await progressing();
  report("chapter end navigates to John 5 and continues on the same audio element");

  await page.locator(".translation-switcher__summary").click();
  await page.locator('.translation-switcher__option[href*="t=YLT"]').click();
  await page.waitForURL(/t=YLT/);
  await page.waitForFunction(() => document.querySelector("audio").paused);
  assert.equal(await main().getAttribute("data-smoke-identity"), "persistent");
  await page.locator(".reader__listen--none").waitFor();
  report("unsupported YLT stops the previous recording during client navigation");

  await openReader("Gen.1");
  await page.getByRole("button", { name: "Reading layers", exact: true }).click();
  await page.getByRole("switch", { name: /^Original language/ }).click();
  await page.keyboard.press("Escape");
  await page.locator(".interlinear__speak").first().waitFor();
  await page.locator("button.reader__listen").click();
  await progressing();
  await page.locator(".interlinear__speak").first().click();
  await page.waitForFunction(() => {
    const [chapter, word] = document.querySelectorAll("audio");
    return chapter.paused && !word.paused && word.currentTime > 0;
  });
  assert.match(await clip().getAttribute("src"), /WLC-beeri\/01-001\.m4a/);
  await page.waitForFunction(() => {
    const [chapter, word] = document.querySelectorAll("audio");
    return !chapter.paused && word.paused;
  });
  await progressing();
  report("Hebrew word clip plays and resumes the chapter");

  await page.getByRole("button", { name: "Close the player", exact: true }).click();
  assert(await main().evaluate((el) => el.paused));
  assert(await clip().evaluate((el) => el.paused));
  assert.deepEqual(errors, [], "unexpected browser errors");
  report("close stops playback; no browser errors");
} catch (error) {
  console.error(JSON.stringify({ passed: false, url: page.url(), error: error.message, browserErrors: errors }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
