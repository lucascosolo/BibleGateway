# Font licences (share cards)

Static cuts of the same families self-hosted in `app/fonts/`, used only by the share-card
renderer (`app/og/route.tsx`), which reads WOFF/TTF/OTF but not WOFF2 and draws only the default
instance of a variable font. Taken from the Fontsource 5.3.0 npm builds (`@fontsource/literata`,
`@fontsource/archivo`, `@fontsource/noto-serif-hebrew`), unmodified.

All are under the **SIL Open Font License 1.1**; the full licence text is in
`../../fonts/LICENSES.md`, and it applies to these files on the same terms.

| File | Family | Copyright |
|---|---|---|
| `literata-latin-400-normal.woff`, `literata-latin-400-italic.woff`, `literata-latin-600-normal.woff`, `literata-latin-ext-400-normal.woff`, `literata-latin-ext-400-italic.woff`, `literata-greek-400-normal.woff`, `literata-greek-ext-400-normal.woff` | Literata | Copyright 2017 The Literata Project Authors (https://github.com/googlefonts/literata) |
| `archivo-latin-600-normal.woff` | Archivo | Copyright 2019 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo) |
| `noto-serif-hebrew-hebrew-500-normal.woff` | Noto Serif Hebrew | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/hebrew) |
