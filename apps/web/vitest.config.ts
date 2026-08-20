import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Next's tsconfig sets `jsx: "preserve"` (Next compiles JSX itself), which leaves esbuild
  // emitting raw JSX and tests failing with "React is not defined". Vitest has no Next
  // pipeline, so tell esbuild to use the automatic runtime directly.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    // jsdom throughout: the selection and four-density regression tests need a DOM, and the
    // pure logic tests (refs, decorations) run identically either way.
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // The renderer regression test mounts several densities at once; give it room.
    testTimeout: 15_000,
  },
});
