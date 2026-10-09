# Jot brand

One hand, one mark, everywhere. The identity is a scribe's brush on a scroll: the word "jot"
written in three strokes with a broad pen, and the tittle set beside it as its own dot. It is
restrained on purpose. The hand lives in the mark, the icon and the tile lockup, and nowhere
else: no brushed rules, ornaments, drop caps, textured grounds or decorative dividers in the
interface, and never on a reading surface. The scholarship is the product; the mark signs it.

## The hand

One pen, nib held at about 30 degrees and rising to the right. Downstrokes press thick (the
j's stem, the t's stem, the sides of the o); horizontals and lifts run thin (the j's entry,
the t's crossbar, the top and bottom of the o). Ends are round, as a brush leaves them. No
flicks, no splatter, no texture.

- **j** is the icon's letter, copied verbatim. `WORDMARK_GEOMETRY.paths[0]` in
  `apps/web/src/components/Wordmark.tsx` is the same path string as the `<path>` in
  `apps/web/public/icon.svg`, and `Wordmark.test.tsx` fails if they ever differ. Edit the j in
  the icon and copy it across, never the other way round.
- **o** is one closed loop: an outer contour and its counter wound in opposite directions, so
  it fills correctly under the default non-zero rule (the share-card renderer has no
  `fill-rule`). Thin at the upper left and lower right, as the 30-degree nib makes it.
- **t** is a tall stem turning into a short foot, then a separate crossbar laid on thin and
  rising slightly. Its ascender tops out just above the tittle.

Metrics, in the icon's 512-unit space: x-height from the j's entry stroke (about 178) to the
baseline (about 374); the j's hook descends to 426; the t's ascender starts at 53, the
tittle's top is at 81. The wordmark's viewBox is `180 48 548 384`.

## The tittle rule

The tittle (Matthew 5:18, "not one jot or one tittle") is always its own element and never
fused with the letter. It is the icon's circle, `cx 304 cy 112 r 31`, in both the icon and the
wordmark.

| Where | Colour | Contrast |
|---|---|---|
| Wordmark, light theme | `--color-rubric` | 5.6:1 on `--color-bg` |
| Wordmark, dark theme | `--color-rubric` (dark value) | 6.4:1 on `--color-bg` |
| On the green tile | `--color-on-tile` (parchment) | 6.4:1; rubric would be 1.1:1 |

Ratios computed oklch to linear sRGB to WCAG relative luminance; re-derive rather than eyeball
if a token moves.

## The two colours, and the tile

| Role | Token (globals.css) | Resolved for raster assets |
|---|---|---|
| Letters | `--color-brand` oklch(46% 0.075 185); dark oklch(72% 0.09 182) | `#14655d` |
| Tittle | `--color-rubric` oklch(52% 0.19 32); dark oklch(70% 0.17 30) | `#be260b` |
| Tile | `--color-tile` oklch(46% 0.075 185), same in both themes | `#14655d` |
| Letter on tile | `--color-on-tile` oklch(97.5% 0.012 78), same in both themes | `#fbf6ee` |
| Ground | `--color-bg` oklch(97.5% 0.012 78) | `#fbf6ee` |

The tile tokens are deliberately not redefined for dark: the tile is the app icon, and an icon
on a home screen does not change with the theme. Components use tokens. Only files that cannot
read CSS (the SVG icon, the PNG set, the share card in `app/og/route.tsx`, the manifest) carry
the resolved hexes, each beside the token it came from.

## The tile and the lockup

The icon (`public/icon.svg`) is the j and its tittle in parchment on a brand-green tile with
116-unit corners, everything inside the central 80 percent so a maskable crop keeps it whole.
`<Wordmark variant="tile">` is the lockup: that tile drawn at the word's height, a gap of a
fifth of it, then the word, as one image named "Jot". It is shown on `/style` and used nowhere
else yet.

## Where the mark appears

- Shell: `NavRail` and `TopTabs` render `<Wordmark size="sm">`; the home page (`lg`), the 404
  (`md`) and `/style` (`xl`, plus the brand section) use the larger sizes.
- `/style`, section "The mark": the icon at 512, the wordmark at sm, md, lg and xl, the lockup,
  both colours with their tokens, and light and dark specimens side by side.
- Share card: `/og` draws `WORDMARK_GEOMETRY` with the resolved colours. A change to the
  geometry is a card design change, so bump `CARD_VERSION` in `lib/seo.ts`.
- App identity: `app/manifest.ts`, `app/layout.tsx` `icons` and `appleWebApp`,
  `public/favicon.ico`, `public/icons/*`. Audio lock screen: `AudioPlayer` sets the Media
  Session album to "Jot".

## Regenerating

**The o and t.** `docs/brand-wordmark-gen.py` sweeps the pen along cubic centrelines and emits
filled outlines as cubic beziers. The shipped letters are exactly the output of

```
python3 docs/brand-wordmark-gen.py '{"thick": 54, "tx": 652}'
```

Paste `o` and `t` into `paths[1]` and `paths[2]`. Render before accepting a change: the mark
at 4.5rem on parchment, on the green tile and on the dark ground, checked against the j for
stroke weight, baseline and x-height.

**The icon PNG set.** ImageMagick's own SVG rasteriser mangles the path, so the master raster
comes from Chromium through Playwright via `docs/brand-icon-render.mjs`. Its bare `playwright`
import resolves from the script's own folder, so copy it into `apps/web` and run it there:

```
node brand-icon-render.mjs   # icon-1024.png and a maskable 1024 with 10% padding
magick public/icons/icon-1024.png -resize 512x512 public/icons/icon-512.png
magick public/icons/icon-1024.png -resize 192x192 public/icons/icon-192.png
magick public/icons/icon-512.png -define icon:auto-resize=48,32,16 public/favicon.ico
magick public/icons/icon-1024.png -background '#fbf6ee' -alpha remove -resize 180x180 public/icons/apple-touch-icon.png
```

Sizes shipped: SVG (any), 192, 512, 512 maskable, 180 Apple touch icon, 1024 (App Store), and
a three-size favicon.ico.

## Voice in the name

"Jot" is capitalised as a name in prose and lower-case in the mark. The tagline is the verse it
comes from; `<Wordmark withTagline>` and `withVerse` are the only two ways to show it.
