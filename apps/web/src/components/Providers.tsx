"use client";

import { useEffect } from "react";
import { usePreferencesStore, usePreferencesTabSync } from "@/lib/store/preferences";

export function Providers({ children }: { children: React.ReactNode }) {
  usePreferencesTabSync();

  const theme = usePreferencesStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  return children;
}
