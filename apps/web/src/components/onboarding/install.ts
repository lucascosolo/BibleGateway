"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";

/**
 * What the home-screen step can honestly say about this browser.
 *
 * "unknown" is a real answer, not a failure: its copy lists both routes rather than guessing,
 * because telling a Firefox reader to look for an install prompt that does not exist is worse
 * than telling them nothing specific.
 */
export type InstallPlatform = "standalone" | "ios" | "chromium" | "unknown";

export function detectInstallPlatform({
  userAgent,
  standalone,
  maxTouchPoints,
}: {
  userAgent: string;
  standalone: boolean;
  maxTouchPoints: number;
}): InstallPlatform {
  if (standalone) return "standalone";
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  // iPadOS asks for the desktop site and reports itself as a Mac; touch points give it away.
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Firefox|FxiOS/.test(userAgent)) return "unknown";
  if (/Chrome\/|Chromium\/|Edg\//.test(userAgent)) return "chromium";
  return "unknown";
}

export function isStandalone(): boolean {
  const media =
    typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return media || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * The platform, read on the client after the first render only. `null` until then, so neither
 * the server render nor hydration claims a platform it cannot know.
 */
export function useInstallPlatform(): InstallPlatform | null {
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  useEffect(() => {
    setPlatform(
      detectInstallPlatform({
        userAgent: navigator.userAgent ?? "",
        standalone: isStandalone(),
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
      }),
    );
  }, []);
  return platform;
}

type DeferredPrompt = { prompt: () => Promise<unknown> };

/** The deferred `beforeinstallprompt`, shared so the tour step and the nudge offer the same one. */
export const useInstallPromptStore = create<{ deferred: DeferredPrompt | null }>(() => ({
  deferred: null,
}));

/**
 * Captures the browser's install prompt and returns a function that shows it, or `null` when
 * there is none to show. A prompt can be shown once, so it is cleared on use.
 */
export function useInstallPrompt(): (() => void) | null {
  const deferred = useInstallPromptStore((s) => s.deferred);
  useEffect(() => {
    function capture(event: Event) {
      event.preventDefault();
      useInstallPromptStore.setState({ deferred: event as Event & DeferredPrompt });
    }
    function installed() {
      useInstallPromptStore.setState({ deferred: null });
    }
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!deferred) return null;
  return () => {
    useInstallPromptStore.setState({ deferred: null });
    void deferred.prompt();
  };
}
