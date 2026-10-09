# Jot brand

One mark, everywhere. The wordmark is the source; every other asset is derived from it, so a
change to the geometry in one place is a change to all of them.

## The mark

`apps/web/src/components/Wordmark.tsx` holds `WORDMARK_GEOMETRY`: the word "jot" drawn as three
stroked paths and a bowl, 8 units wide with round caps, plus the tittle as a separate dot. The
tittle is the point of the name (Matthew 5:18, "one jot or one tittle") and is never fused with
the letter: it sits a quarter-stroke above the j in the second brand colour.

The app icon (`apps/web/public/icon.svg`) is the j and its tittle from that geometry, scaled six
times and centred on a parchment tile with 116-unit corners. Nothing else is drawn on it.

## The two brand colours, and the ground

| Role | Token (globals.css) | Resolved for raster assets |
|---|---|---|
| Stroke | `--color-brand` oklch(46% 0.075 185) | `#14655d` |
| Tittle | `--color-rubric` oklch(52% 0.19 32) | `#be260b` |
| Ground | `--color-bg` oklch(97.5% 0.012 78) | `#fbf6ee` |
| Theme colour in the manifest | `--color-brand` | `#14655d` |

Components use the tokens. Only files that cannot read CSS (the SVG icon, the PNG set, the share
card in `app/og/route.tsx`, the manifest) carry the resolved hexes, and each records the token it
came from beside the value.

## Where the mark appears

- Shell: `NavRail` and `TopTabs` render `<Wordmark>`; the home page, the 404 and `/style` use the
  larger sizes.
- Share card: `/og` draws the same geometry with the resolved colours.
- App identity: `app/manifest.ts` (name "Jot", icons), `app/layout.tsx` `icons` and `appleWebApp`,
  `public/favicon.ico`, `public/icons/*`.
- Audio lock screen: `AudioPlayer` sets the Media Session album to "Jot".

## Regenerating the icon set

ImageMagick's own SVG rasteriser drops the stroked path, so the master raster is produced by
Chromium through Playwright (from `apps/web`, with the SVG at `public/icon.svg`):

```
node $TMPDIR/icon-render.mjs        # renders icon-1024.png and a maskable 1024 with 10% padding
magick public/icons/icon-1024.png -resize 512x512 public/icons/icon-512.png
magick public/icons/icon-1024.png -resize 192x192 public/icons/icon-192.png
magick public/icons/icon-512.png -define icon:auto-resize=48,32,16 public/favicon.ico
magick public/icons/icon-1024.png -background '#fbf6ee' -alpha remove -resize 180x180 public/icons/apple-touch-icon.png
```

The render script is twelve lines: load the SVG into a 512px page at device scale 2, screenshot
with a transparent background for the plain icon and a parchment page with 51px padding for the
maskable one. Keep a copy beside this file if it is ever lost from the scratchpad.

Sizes shipped: SVG (any), 192, 512, 512 maskable, 180 Apple touch icon, 1024 (App Store), and a
three-size favicon.ico.

## Voice in the name

"Jot" is capitalised as a name in prose and lower-case in the mark. The tagline is the verse it
comes from; `<Wordmark withTagline>` and `withVerse` are the only two ways to show it.
