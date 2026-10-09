import { describe, expect, it } from "vitest";

import { detectInstallPlatform, useInstallPromptStore } from "./install";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  ipod: "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
  ipadOs: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  chromeLinux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  chromeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  chromeMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
  firefoxAndroid: "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0",
};

const detect = (userAgent: string, standalone = false, maxTouchPoints = 0) =>
  detectInstallPlatform({ userAgent, standalone, maxTouchPoints });

describe("detectInstallPlatform", () => {
  it("standalone wins over any UA", () => {
    expect(detect(UA.iphone, true)).toBe("standalone");
    expect(detect(UA.chromeWin, true)).toBe("standalone");
    expect(detect("", true)).toBe("standalone");
  });

  it("recognises iPhone, iPad and iPod as ios", () => {
    expect(detect(UA.iphone)).toBe("ios");
    expect(detect(UA.ipad)).toBe("ios");
    expect(detect(UA.ipod)).toBe("ios");
  });

  it("recognises iPadOS masquerading as a Mac by its touch points", () => {
    expect(detect(UA.ipadOs, false, 5)).toBe("ios");
    expect(detect(UA.ipadOs, false, 0)).toBe("unknown");
  });

  it("recognises Chromium browsers", () => {
    for (const ua of [UA.androidChrome, UA.chromeLinux, UA.chromeWin, UA.chromeMac, UA.edge]) {
      expect(detect(ua)).toBe("chromium");
    }
  });

  it("treats Firefox and an empty UA as unknown", () => {
    expect(detect(UA.firefox)).toBe("unknown");
    expect(detect(UA.firefoxAndroid)).toBe("unknown");
    expect(detect("")).toBe("unknown");
  });
});

describe("useInstallPromptStore", () => {
  it("starts with nothing captured", () => {
    expect(useInstallPromptStore.getState().deferred).toBeNull();
  });
});
