import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Invariant #2: there is exactly ONE scripture renderer.
    //
    // `AGENTS.md` and `PassageRenderer.tsx` both claimed this was enforced by lint. It was
    // not — the config was stock Next, and the single renderer survived on discipline alone.
    // A second renderer is not a visible bug; it is a silent end to universal annotation
    // persistence, which is only free because every surface subscribes to the same per-verse
    // atoms. That is exactly the class of regression a human review misses, so it is a rule.
    //
    // The line drawn is the decoration/annotation pipeline: rendering scripture text means
    // composing decorations over it, so anything outside `components/passage/` reaching for
    // that machinery is building a second renderer whether or not it is named one.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/passage/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/decorations", "**/lib/decorations/*", "@/lib/decorations", "@/lib/decorations/*"],
              message:
                "The decoration pipeline belongs to THE renderer. Render scripture with <PassageRenderer density=...> instead of building a second renderer — universal annotation persistence depends on every surface sharing one component. See AGENTS.md invariant #2.",
            },
            {
              group: ["**/components/passage/Verse", "@/components/passage/Verse"],
              message:
                "Import PassageRenderer, not Verse. Verse is an implementation detail of THE renderer; mounting it directly bypasses layer ceilings and the omission apparatus. See AGENTS.md invariant #2.",
            },
          ],
        },
      ],
    },
  },
  {
    // The other half of invariant #2 — the one the rule above did not cover.
    //
    // Blocking the decoration pipeline and `<Verse>` stops someone *reimplementing* the
    // renderer. It does nothing about the shorter route to the same place: import
    // `getPassage` (or fetch `/api/passage`), map over the rows, and print `verse.text` in a
    // component of your own. That is a second renderer with none of the layer ceilings, none
    // of the omission apparatus, and no subscription to the per-verse atoms — so annotations
    // made in it never appear anywhere else and annotations made elsewhere never appear in it.
    // The guard claimed a boundary it was not drawing; this draws it.
    //
    // Server corpus text accessors belong to server pages and route handlers (`src/app/**`),
    // to the db layer itself, and to `lib/crossrefs/resolve.ts`, which is `server-only` and
    // exists precisely to shape corpus rows for the renderer. Everything else — every
    // component, every other lib module — goes through `<PassageRenderer>`.
    //
    // `allowTypeImports` is the reason this is the typescript-eslint variant of the rule.
    // `import type { VerseText }` is how the renderer and its previews type their props; it is
    // erased at compile time, carries no query layer into the bundle, and is legitimate
    // everywhere. Nine existing sites do exactly that (CorpusFacts, CorpusDoorways,
    // ChapterIndex, DerashSearch, PassageRenderer, Verse, lib/crossrefs/types, and two tests)
    // and none of them are the thing this rule is for.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/**", "src/lib/db/**", "src/lib/crossrefs/resolve.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          // `allowTypeImports` belongs to each pattern, not to the options object — at the top
          // level the schema rejects it and eslint fails to start, which the build's lint gate
          // catches as a hard failure rather than silently dropping the rule.
          patterns: [
            {
              group: [
                "@/lib/db/corpus",
                "@/lib/db/apparatus",
                "@/lib/db/client",
                // `originals` is on this list for exactly the same reason as `corpus`, and it
                // was added in the same change that created it. Hebrew and Greek words ARE
                // scripture text; a component that imports `getInterlinear` and maps over the
                // rows is a second renderer just as surely as one that maps over `getPassage`,
                // with the same consequence — no layer ceilings, no shared atoms, annotations
                // that do not persist across it. AGENTS.md invariant #2 says to enumerate the
                // ways around a boundary before believing the claim it lets you write; a new
                // corpus accessor that is not on this list is one of them.
                "@/lib/db/originals",
                "**/lib/db/corpus",
                "**/lib/db/apparatus",
                "**/lib/db/client",
                "**/lib/db/originals",
              ],
              allowTypeImports: true,
              message:
                "Corpus text accessors belong to server pages and route handlers, not to components. Fetch the passage on the server and render it with <PassageRenderer>; a component that queries the corpus and prints verse.text itself is a second renderer, and annotations will not persist across it. Type-only imports are fine. See AGENTS.md invariant #2.",
            },
          ],
        },
      ],
    },
  },
  {
    // Same boundary, the other direction: reaching the corpus over HTTP instead of importing
    // it. `/api/passage` returns verse text, so a component fetching it is one `.map()` away
    // from rendering scripture outside THE renderer — `no-restricted-imports` cannot see a
    // string, so this is a syntax rule.
    //
    // The route handler itself and the renderer's own directory are exempt. Nothing currently
    // matches: today the only occurrences of the path are in comments, which are not literals.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/**", "src/components/passage/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // `[/]` rather than an escaped slash — esquery takes a JS regexp body, and a
          // character class keeps the delimiter unambiguous.
          selector: "Literal[value=/api[/]passage/]",
          message:
            "Do not fetch /api/passage from a component. Passage text is loaded by a server page and rendered by <PassageRenderer>; fetching it here is how a second renderer starts. See AGENTS.md invariant #2.",
        },
        {
          selector: "TemplateElement[value.raw=/api[/]passage/]",
          message:
            "Do not fetch /api/passage from a component. Passage text is loaded by a server page and rendered by <PassageRenderer>; fetching it here is how a second renderer starts. See AGENTS.md invariant #2.",
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
