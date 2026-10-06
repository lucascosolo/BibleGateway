"use client";

import type { ReactNode } from "react";
import { useEffectiveLayers } from "@/lib/store/preferences";

export function CrossRefLayer({ children }: { children: ReactNode }) {
  const layers = useEffectiveLayers();
  return layers.crossRefs ? children : null;
}
