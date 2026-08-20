"use client";

import clsx from "clsx";
import { usePreferencesStore, type ThemePreference } from "@/lib/store/preferences";
import { SunIcon, MoonIcon, MonitorIcon } from "./icons";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
];

export function ThemeToggle({ className }: { className?: string }) {
  const theme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={clsx(
        "inline-flex items-center gap-0.5 rounded-[var(--radius-full)] border border-[var(--color-border)] bg-[var(--color-bg-sunken)] p-1",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={clsx(
              "flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] transition-colors",
              active
                ? "bg-[var(--color-brand)] text-on-accent"
                : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)]",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
