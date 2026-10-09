# iOS release readiness plan

Written 2026-10-09. The user asked to prepare Jot for a possible App Store release. This plan
records what is already in place, what can be done on this Linux PC now, and what needs a Mac.

**Goal:** Jot runs as a native iOS app that wraps the same web app, passes App Store review, and
shares one codebase with the site.

**Approach:** a Capacitor shell (WKWebView) loading the deployed site, with the native bits the
web cannot do (background audio session category, status bar, splash, share sheet) added through
Capacitor plugins. The alternative, a SwiftUI rewrite, was rejected: the renderer invariant and
the apparatus live in the web app and a second implementation would fork them. A bare PWA was
also rejected for the store: Apple does not list PWAs, and review guideline 4.2 rejects a shell
that only shows a website, so the shell must add native value (offline corpus, audio session,
lock-screen controls, notifications are candidates).

## Already in place (2026-10-09)

- Web manifest (`app/manifest.ts`), 180px Apple touch icon, 1024px App Store icon
  (`public/icons/icon-1024.png`), `appleWebApp` metadata, `viewportFit: cover`.
- Single `<audio>` element with Media Session metadata and lock-screen controls; chapter hand-off
  on the same element so playback continues when the screen is locked.
- Mobile-first layout with a 44px touch floor and container queries; the reader, timeline and
  investigation pages have been checked at 390px.
- All colours are tokens with light and dark themes; `prefers-color-scheme` is honoured.

## Chunk 1: Capacitor project scaffold (this PC, no Mac needed)
Files: `apps/ios/package.json`, `apps/ios/capacitor.config.ts`, `apps/ios/README.md`, root `package.json` workspaces entry if one exists.
Steps:
- [ ] `capacitor.config.ts`: `appId: "com.lucascosolo.jot"`, `appName: "Jot"`, `webDir` pointing at a static export is NOT possible (the app is server-rendered), so use `server: { url: "https://bible.lucascosolo.com", cleartext: false }` with `ios: { contentInset: "automatic", backgroundColor: "#fbf6ee" }`. Record in the README why a remote server URL is acceptable here (the app is the live site; offline comes in chunk 4).
- [ ] `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/status-bar @capacitor/splash-screen @capacitor/app` from a machine with registry access (npm is proxied here and returned 407 on 2026-10-08; use the user's own terminal or the Mac).
- [ ] `npx cap add ios` (needs CocoaPods and Xcode, so this step runs on the Mac).
Success criteria: `npx cap doctor` reports iOS ready on the Mac.

## Chunk 2: native audio session
Files: `apps/web/src/components/audio/AudioPlayer.tsx` (feature detection only), `apps/ios/ios/App/App/AppDelegate.swift`.
Steps:
- [ ] In `AppDelegate`, set `AVAudioSession` category `.playback` so the WKWebView's audio keeps playing when the app is backgrounded and the screen locks, and add the `audio` background mode to `Info.plist`.
- [ ] Verify on a device that the Media Session `nexttrack` and `previoustrack` handlers map to the lock-screen buttons inside the shell (they do in Safari; WKWebView needs iOS 15+).
Success criteria: a chapter boundary passes with the app backgrounded and the next chapter plays.

## Chunk 3: status bar, splash, safe areas
Files: `apps/ios/capacitor.config.ts`, splash assets under `apps/ios/ios/App/App/Assets.xcassets`, `apps/web/src/app/globals.css`.
Steps:
- [ ] Splash: the parchment tile with the j mark centred, from `public/icon.svg`, at 2732x2732 for the universal storyboard.
- [ ] Status bar style follows the theme (`StatusBar.setStyle` from a `prefers-color-scheme` listener in a tiny bridge, or leave `default` and let the web view's `theme-color` meta drive it).
- [ ] Audit `env(safe-area-inset-*)` use: the bottom tab bar and the audio bar already pad for the home indicator; confirm the top of the reader clears the notch under `contentInset: automatic`.
Success criteria: screenshots on an iPhone 15 simulator at both themes show no content under the notch or home indicator.

## Chunk 4: offline reading (the native value that passes review 4.2)
Files: `apps/web/src/lib/db/corpus.ts` (no change), a new `apps/ios` plugin or `@capacitor/filesystem` use, `apps/web/src/app/api/passage/route.ts` (ETag already present).
Steps:
- [ ] Decide the offline scope with the user: one translation's text for the whole Bible is about 4 MB as JSON; the full `bible.db` is larger and would need a SQLite plugin. Recommend the JSON-per-translation cache first.
- [ ] A service worker in the web app (also benefits the PWA) caching `/api/passage` responses by ETag and the reader's static assets, with a visible "available offline" state per translation.
Success criteria: airplane mode, open the app, read Genesis 1 in the cached translation.

## Chunk 5: store listing
Files: `docs/ios/listing.md`, screenshots under `docs/screenshots/ios/`.
Steps:
- [ ] Apple Developer Program enrolment (paid, the user's decision and account).
- [ ] App name "Jot", subtitle, description from `layout.tsx`'s metadata, keywords, privacy answers: the app stores annotations on the server (userdata.db) and uses no tracking; the privacy policy page must exist on the site before submission (none exists on 2026-10-09; add `/privacy`).
- [ ] Screenshots at 6.7" and 6.1" from the simulator via `scripts/shoot.mjs` equivalents.
- [ ] Translation licences: every translation's copyright notice already travels with its text; list them in the app's about screen as well, since reviewers look for third-party content rights.
Success criteria: the listing form has no empty required field.

## Open questions for the user
- Apple Developer Program: enrol as an individual (Lucas Cosolo) or an organisation?
- Offline scope for chunk 4 (one translation, or all public-domain ones).
- Whether the iOS app should hide the "Support Jot" link (set NEXT_PUBLIC_SUPPORT_URL empty in the shell build) (Apple guideline 3.1.1 forbids linking out to external payment for digital goods; a donation link to a non-profit is allowed through approved platforms, and a general "support" link on a free app with no unlocks is tolerated but the safe choice is to show it only on the web).

## Preconditions checked on 2026-10-09
- No Mac or Xcode is available in this environment; chunks 1 (install), 2, 3 and 5 need one.
- npm registry access from this PC is proxied and failed with 407 on 2026-10-08.
- `/privacy` does not exist on the site.
