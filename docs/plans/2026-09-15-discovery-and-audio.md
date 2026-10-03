# Discovery, support, and audio completion

## Scope and approach

Improve the existing verse-addressed reader rather than introduce duplicate SEO pages.
All scripture continues through PassageRenderer. Index real corpus rows only; preserve
translation identity in canonicals. NIV is not installed and must never be advertised as
available. Public tools remain discoverable; private notes and unfinished placeholders
should not become search results. Existing audio changes are now authorized for completion.

## Chunks

1. Discovery: complete corpus-backed sitemap coverage, route metadata/canonicals, crawlable
   reference content and navigation, truthful AI documentation. Verify raw HTML and sitemap
   entries for obscure verses, translation variants, omissions and invalid references.
2. Audio: reconcile existing source and pipeline artifacts with the September 4 plan; finish
   playback, artifact packaging and verification without restarting costly full alignment.
   Report coverage and any remaining unavailable recordings accurately.
3. Support/publication: add a small support link in existing site chrome; write a brief factual
   Patreon announcement, apply humanize-writing, publish and verify its permalink.
4. Integrated verification: use an isolated utility VPS scratch tree (project forbids local
   installs/builds), run build, lint, tests, raw HTTP checks and browser checks. Stop all preview
   processes started by this task. Prepare any release for review before production deployment.

## Ownership

SEO worker owns metadata, sitemaps and reference crawlability. Audio worker owns audio files,
pipeline and its existing wiring; coordinate shared reader/layout changes. Coordinator owns
support link, Patreon, continuity records, integration and remote verification.

## Evidence

At task start live /api/translations lists WEB, BSB, KJV, ASV, DBY, YLT, JPS and a partial LXX.
Sitemap contains sample chapters only. CrossRefPanel fetches after mount; ReaderApparatus
does not mount it in server HTML. Live service is utility:/srv/jot; old build scripts are stale.

## Implementation and verification — 2026-09-16 UTC

- Corpus-backed sitemap index: 298,592 URLs across twelve shards. Independent SQLite/HTTP
  verification found no missing or invented reader URLs; concordance key coverage also matches.
- Reader, comparison, reference-network and concordance metadata preserve reference/translation
  identity. Reader HTML includes scripture, linked references, verse navigation and structured
  data. NIV coverage is explained beside the corpus inventory; NIV text is not advertised.
- Added footer links to Patreon, lucascosolo.com and the research API.
- Final utility preview build and lint passed; 296 app tests passed. Lint retains five existing
  warnings. Full screenshot harness captured 360 states, followed by sixteen final captures.
  Layout measurements found no problems; axe WCAG A/AA and keyboard checks passed.
- Real Chromium playback passed verse seeking, pause/resume, chapter continuation, translation
  changes and Hebrew word clips. Range requests returned correct 206/416 responses. Independent
  regressions cover sparse cross-book chapters, untimed selections and stale playback promises.
- Packaged the available recordings from a fixed snapshot. The full audio alignment is running
  separately under explicit user authorization; see the audio plan for coverage and job details.
- Patreon announcement was written and checked with humanize-writing. Publication is pending:
  Claude Browser reports reCAPTCHA, and the requested Chrome fallback rejects Patreon via its
  built-in domain-category policy. No permission-setting cause was established.
- Production has not been changed. Preview artifacts are staged on the utility VPS for review.
