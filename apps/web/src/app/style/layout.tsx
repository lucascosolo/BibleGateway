import type { ReactNode } from "react";

import { shareMetadata } from "@/app/og/data";

export const metadata = {
  ...shareMetadata("Style reference · Jot", "The typography, colour and components Jot is built from.", "/style", { card: { kind: "page", page: "style" } }),
  robots: { index: false, follow: false },
};

export default function StyleLayout({ children }: { children: ReactNode }) { return children; }
