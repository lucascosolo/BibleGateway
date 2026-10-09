"use client";

import { useInstallPlatform, useInstallPrompt } from "./install";

const PRIMARY =
  "min-h-[var(--touch-target)] w-fit rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 font-sans text-[length:var(--text-sm)] font-semibold text-[var(--color-bg)] hover:opacity-90";
const TEXT = "font-sans text-[length:var(--text-sm)] leading-relaxed text-[var(--color-ink)]";

/**
 * How to install, for the browser in front of us. Says only what it can tell: a browser it does
 * not recognise gets both routes, never a guess presented as fact.
 */
export function InstallPanel() {
  const platform = useInstallPlatform();
  const install = useInstallPrompt();

  if (platform === "standalone") {
    return <p className={TEXT}>Jot is already installed: you are using it from your home screen now. Nothing to do here.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {platform === "ios" && (
        <p className={TEXT}>
          In Safari, tap the Share button (the square with an arrow pointing up), scroll the list, and
          choose “Add to Home Screen”.
        </p>
      )}
      {platform === "chromium" && (
        <p className={TEXT}>
          {install
            ? "Your browser can install Jot as an app. Press Install and confirm."
            : "Open the browser menu and choose “Install app” or “Add to Home screen”. On a computer, an install icon may also sit at the right of the address bar."}
        </p>
      )}
      {(platform === "unknown" || platform === null) && (
        <ul className={`${TEXT} flex list-disc flex-col gap-1 pl-5`}>
          <li>On an iPhone or iPad, in Safari: tap Share, then “Add to Home Screen”.</li>
          <li>On Android, or in Chrome or Edge on a computer: open the browser menu and choose “Install app”.</li>
        </ul>
      )}
      {install && (
        <button type="button" onClick={install} className={PRIMARY}>
          Install
        </button>
      )}
    </div>
  );
}
