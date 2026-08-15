# Daily study and discovery — design specification

**Date:** 2026-08-15

**Status:** User-approved direction; written specification awaiting review

**Scope:** An ongoing curated daily-study sequence, optional reading plans, cited literary
structures, original-language distinctions, narrative observations, and opt-in reminders.

## 1. Product intent

Jot should make a few minutes of Bible reading easy to remember, easy to begin, and worthwhile in
itself. Every daily session must teach one accurate, memorable thing that a reader could discuss
with a friend. Finishing the short session must feel complete; continuing into a longer reading
must feel inviting rather than required.

This is neither a devotional feed nor a gamified streak product. Jot observes the text, identifies
where published interpreters disagree, and gives readers good questions. It does not tell them
which theological conclusion to adopt.

### Goals

1. Put one coherent 3–7 minute reading one action away from the home page and every reminder.
2. Pair that reading with one new, interesting, citation-backed observation.
3. Offer deeper original-language, translation, literary, historical, or intertextual material
   without making it necessary to finish the short session.
4. Make continued reading the natural next action.
5. Maintain an ongoing, editorially scheduled daily sequence and optional longer-term plans.
6. Explain literary devices and translation compression without presenting contested analysis as
   machine-detected fact.
7. Help readers return through honest progress, a calendar reminder, and optional device push.
8. Preserve Jot's three invariants: one `verse_id` address, one scripture renderer, and sparse
   range handling.

### Non-goals

- Generated-at-request commentary, questions, or literary analysis.
- Community submissions or moderation workflows.
- Leaderboards, points, guilt copy, destructive streak resets, or fabricated urgency.
- Claims that an English gloss exhausts a Hebrew, Aramaic, or Greek word's meaning.
- Automated chiasm or inclusio discovery presented as scholarship.
- Email reminders, social accounts, or a general-purpose notification platform.
- A second scripture rendering surface for study sessions.

## 2. Editorial contract

Only first-party curated and reviewed entries ship. Every entry separates three epistemic layers:

1. **What the text does** — an observable feature such as repetition, a speaker transition, a
   sequence of character labels, or a translation difference.
2. **What interpreters propose** — one or more concise, attributed readings. Each proposal has its
   own source rather than borrowing authority from a citation attached to the entry as a whole.
3. **Questions to ponder** — open questions that do not smuggle in a preferred answer.

The editor must be able to trace every externally sourced factual or interpretive claim to a
source record with author or responsible organization, title, publication, year, locator, and URL
where one exists. A source link is helpful but not a substitute for a page, section, entry, or
other stable locator.

Editorial prose uses plain English first. Genuine terms such as *chiasm* and *inclusio* receive a
plain-English gloss through `lib/lexicon.ts`; the global Plain labels preference remains able to
replace them. No user-facing biblical or philological term is hard-coded outside that lexicon.

### 2.1 Worked narrative pattern

A discovery about Genesis 18–19 first states only the narrative sequence: three men appear to
Abraham; YHWH speaks within the scene; two visitors proceed toward Sodom; Genesis 19 calls the
arriving pair angels. Any explanation of the scene follows under an attributed interpretation.
The questions may invite readers to consider divine presence, representation, hospitality, and
narrative point of view, but may not lead with a conclusion disguised as a question.

### 2.2 Original-word pattern

A discovery about English “God” and “Lord” can compare `YHWH`, `Adonai`, `Elohim`, `El`, `Eloah`,
`El Shaddai`, and `Ehyeh`. The UI derives the actual surface form, lemma, transliteration, gloss,
morphology, and loaded translations' renderings from the existing corpus. Editorial text supplies
context and limits, including both warnings:

- The same English rendering does not prove that two original expressions are identical.
- Different English renderings do not prove that two expressions are unrelated.

No copied token text or translation wording is stored in the discovery record. Rebuilding a
translation or original-language source therefore cannot leave the study card quoting stale text.

### 2.3 Literary-structure pattern

Chiasms, inclusios, and poetic parallelism are published proposals, stored with a citation per
structure. Multiple proposals may overlap the same passage and the UI must let the reader switch
between them. The label is “Proposed structure” unless the structure is mechanically verifiable.

Acrostics are the initial mechanically verifiable exception. A structure may be labelled
“Verified from the Hebrew initials” only when the ingest gate recomputes the initials from the
stored original-language tokens and matches the curated expected sequence. The label does not
imply anything about the acrostic's interpretation.

## 3. Daily experience

### 3.1 Entry points

- The top of the home page contains a single prominent **Today's reading** card with a concrete
  hook, reference, time estimate, and **Begin** or **Continue** action.
- `/study` is the Study workspace: today's session, reminder controls, current plans, recent study
  days, and an archive of completed discoveries.
- `/study/[slug]` is a stable, shareable discovery URL. It never embeds the current date in its
  identity.
- The primary navigation label is **Study**. If a scholarly twin is displayed, `Seder` and its
  gloss come from the shared lexicon.
- A calendar event or notification opens `/study`, which resolves the reader's local date to the
  scheduled discovery and then redirects to its stable slug.

### 3.2 Session rhythm

Every daily session uses the same short rhythm:

1. **Read** — a coherent passage in the existing `PassageRenderer`.
2. **Notice** — one observable, memorable detail in ordinary language.
3. **Look closer** — optional original words, translation comparison, literary structure, related
   verses, or attributed interpretations.
4. **Ponder** — one to three open questions.
5. **Finish** — a concise “Talk about it” takeaway with passage and sources.

“Look closer” is progressive disclosure, not a separate route and not a prerequisite for
completion. The core passage and Notice section together must fit the advertised 3–7 minute
estimate. The estimate is editorial, based on word count plus a small fixed allowance for the
observation; it is not personalized surveillance.

Completion means the session's passage and Notice stage were reached and the reader deliberately
finished the session. Jot calls that a **completed session**, not proof that every verse was read
or understood. Separately stored passage-visibility events may support honest “verses viewed”
reporting, but they never become a comprehension claim.

### 3.3 Continue reading

The completion screen offers **Finish for today** first and **Keep reading** second. Keep reading
offers no more than three context-aware choices:

1. Continue into the surrounding chapter or next coherent passage.
2. Open one related curated discovery.
3. Resume the reader's selected plan.

The first choice is always direct scripture reading. Jot must not build an endless carousel of
cards that keeps the reader in commentary while calling it Bible study.

### 3.4 Daily schedule

The daily sequence is ongoing, not a 30-day course. Curated entries carry explicit publication
dates. The same local calendar date resolves to the same discovery for all readers, which makes
the day's observation naturally discussable with friends.

- A missed day remains in the archive; it is not silently reassigned or marked as failure.
- An unfinished prior session remains reachable as **Continue**, while today's discovery remains
  visible.
- The schedule never repeats an entry while describing it as new.
- The corpus validation gate requires at least 60 consecutive scheduled days beginning at its
  build date. This is an operational runway, not a numbered user-facing course.
- If the schedule is exhausted, Jot says that no new discovery was published that day and offers
  the reader's plan and ordinary reader. It never recycles an entry under “new today.”

The launch catalog must span both Testaments where licensing and canon coverage allow and must not
cluster familiar proof texts. Across every rolling 30 scheduled entries, the validation gate
requires at least four books, three literary genres, and three insight kinds. This is a diversity
floor, not an editorial recommendation engine.

## 4. Reading plans and progress

Plans reuse the exact session component. A plan step may point to a discovery or to a passage-only
reading, and every passage still uses the one `PassageRenderer`. Initial plan kinds are canonical,
chronological, and thematic. Plan titles and descriptions must state whether the order is textual,
narrative-historical, or editorial; “chronological” may not conceal one disputed chronology.

Progress emphasizes accumulation:

- Total study days, completed sessions, current plan position, and recent topics.
- A calendar with honest study days and visible gaps.
- No single number that resets after a missed day.
- Plans can be paused, changed, or abandoned without warnings or deleted history.
- Translation switching never affects progress because every step is anchored by canonical
  `verse_id` ranges.

The progress UI must not claim that a passage was read merely because it rendered. It may report
“session completed,” “passage opened,” or measured “verses viewed,” according to the evidence it
actually has.

## 5. Content schema in `bible.db`

All curated content is immutable corpus data and participates in the content-derived build ID.
Names below are normative; the implementation plan may split SQL migrations from loading code but
must not collapse the two database lifecycles.

### 5.1 Sources and discoveries

```sql
CREATE TABLE study_sources (
  source_id       TEXT PRIMARY KEY,
  author          TEXT NOT NULL,
  title           TEXT NOT NULL,
  publication     TEXT NOT NULL,
  publication_year INTEGER,
  locator         TEXT NOT NULL,
  url             TEXT,
  license_note    TEXT
);

CREATE TABLE study_discoveries (
  discovery_id    TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  hook             TEXT NOT NULL,
  start_verse_id  INTEGER NOT NULL REFERENCES verses(verse_id),
  end_verse_id    INTEGER NOT NULL REFERENCES verses(verse_id),
  estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes BETWEEN 3 AND 10),
  insight_kind    TEXT NOT NULL CHECK (insight_kind IN
                    ('literary','original_word','translation','narrative','historical','intertextual')),
  notice_text     TEXT NOT NULL,
  takeaway_text   TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('draft','reviewed','published')),
  reviewed_by     TEXT,
  reviewed_at     TEXT,
  CHECK (end_verse_id >= start_verse_id),
  CHECK (
    (status = 'draft')
    OR
    (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE TABLE study_interpretations (
  interpretation_id TEXT PRIMARY KEY,
  discovery_id    TEXT NOT NULL REFERENCES study_discoveries(discovery_id),
  label           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  source_id       TEXT NOT NULL REFERENCES study_sources(source_id),
  sort_order      INTEGER NOT NULL,
  UNIQUE (discovery_id, sort_order)
);

CREATE TABLE study_questions (
  question_id     TEXT PRIMARY KEY,
  discovery_id    TEXT NOT NULL REFERENCES study_discoveries(discovery_id),
  question_text   TEXT NOT NULL,
  sort_order      INTEGER NOT NULL,
  UNIQUE (discovery_id, sort_order)
);

CREATE TABLE study_discovery_sources (
  discovery_id    TEXT NOT NULL REFERENCES study_discoveries(discovery_id),
  source_id       TEXT NOT NULL REFERENCES study_sources(source_id),
  claim_scope     TEXT NOT NULL,
  PRIMARY KEY (discovery_id, source_id, claim_scope)
);
```

`claim_scope` is a short editor-facing description of what the source supports. It prevents a
single bibliography row from laundering every statement in a card into “cited.”

### 5.2 Daily schedule and related readings

```sql
CREATE TABLE study_daily_schedule (
  local_date      TEXT PRIMARY KEY, -- YYYY-MM-DD; one editorial schedule worldwide
  discovery_id    TEXT NOT NULL UNIQUE REFERENCES study_discoveries(discovery_id)
);

CREATE TABLE study_related_readings (
  relation_id     TEXT PRIMARY KEY,
  discovery_id    TEXT NOT NULL REFERENCES study_discoveries(discovery_id),
  relation_kind   TEXT NOT NULL CHECK (relation_kind IN ('continue','related')),
  label           TEXT NOT NULL,
  start_verse_id  INTEGER NOT NULL REFERENCES verses(verse_id),
  end_verse_id    INTEGER NOT NULL REFERENCES verses(verse_id),
  sort_order      INTEGER NOT NULL,
  CHECK (end_verse_id >= start_verse_id),
  UNIQUE (discovery_id, sort_order)
);
```

The date is selected from the browser's IANA timezone and sent explicitly. Server timezone must
never decide which discovery is “today.” On the first visit, a tiny client bootstrap reads
`Intl.DateTimeFormat().resolvedOptions().timeZone`, posts it to a route handler, and receives a
same-site `jot_tz` cookie; `/study` then redirects once to the correct stable discovery slug. Later
Server Component renders, home-page cards, calendar opens, and notification opens read that cookie
and can include the day's scripture in the server response. Until the bootstrap completes, the
home card says **Find today's reading** rather than guessing from the VPS clock. A rejected or
invalid timezone falls back to UTC only after disclosing that choice in Study settings.

### 5.3 Original-word focus

```sql
CREATE TABLE study_word_focus (
  focus_id        TEXT PRIMARY KEY,
  discovery_id    TEXT NOT NULL REFERENCES study_discoveries(discovery_id),
  verse_id        INTEGER NOT NULL REFERENCES verses(verse_id),
  text_id         INTEGER NOT NULL REFERENCES original_texts(text_id),
  word_position   INTEGER NOT NULL,
  explanation     TEXT NOT NULL,
  sort_order      INTEGER NOT NULL,
  UNIQUE (discovery_id, verse_id, text_id, word_position)
);
```

The address remains `verse_id`; `text_id` and `word_position` qualify which existing token inside
that verse the card discusses. They are not accepted by routes as an alternative passage address.
The ingest gate proves that each tuple resolves to exactly one `original_words` row.

### 5.4 Literary structures

```sql
CREATE TABLE literary_structures (
  structure_id    TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  structure_kind  TEXT NOT NULL CHECK (structure_kind IN
                    ('chiasm','inclusio','parallelism','acrostic')),
  start_verse_id  INTEGER NOT NULL REFERENCES verses(verse_id),
  end_verse_id    INTEGER NOT NULL REFERENCES verses(verse_id),
  explanation     TEXT NOT NULL,
  evidence_kind   TEXT NOT NULL CHECK (evidence_kind IN ('published_proposal','mechanically_verified')),
  source_id       TEXT REFERENCES study_sources(source_id),
  expected_initials TEXT,
  CHECK (end_verse_id >= start_verse_id),
  CHECK (
    (evidence_kind = 'published_proposal' AND source_id IS NOT NULL AND expected_initials IS NULL)
    OR
    (evidence_kind = 'mechanically_verified' AND structure_kind = 'acrostic'
      AND expected_initials IS NOT NULL)
  )
);

CREATE TABLE literary_structure_units (
  unit_id         TEXT PRIMARY KEY,
  structure_id    TEXT NOT NULL REFERENCES literary_structures(structure_id),
  label           TEXT NOT NULL,       -- A, B, center, B-prime, A-prime
  display_label   TEXT NOT NULL,       -- accessible editorial label
  pair_key        TEXT,                -- same key for A/A-prime; NULL for an unpaired center
  start_verse_id  INTEGER NOT NULL REFERENCES verses(verse_id),
  end_verse_id    INTEGER NOT NULL REFERENCES verses(verse_id),
  depth           INTEGER NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL,
  CHECK (end_verse_id >= start_verse_id),
  UNIQUE (structure_id, sort_order)
);

CREATE TABLE study_discovery_structures (
  discovery_id    TEXT NOT NULL REFERENCES study_discoveries(discovery_id),
  structure_id    TEXT NOT NULL REFERENCES literary_structures(structure_id),
  sort_order      INTEGER NOT NULL,
  PRIMARY KEY (discovery_id, structure_id)
);
```

Every structure unit intersects its encoded range with `getExistingVerseIds`; no code increments
the integer address. Paired labels must occur exactly twice and in mirrored order. An unpaired
center may occur once.

### 5.5 Plans

```sql
CREATE TABLE study_plans (
  plan_id         TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  plan_kind       TEXT NOT NULL CHECK (plan_kind IN ('canonical','chronological','thematic')),
  chronology_note TEXT,
  status          TEXT NOT NULL CHECK (status IN ('draft','reviewed','published'))
);

CREATE TABLE study_plan_steps (
  step_id         TEXT PRIMARY KEY,
  plan_id         TEXT NOT NULL REFERENCES study_plans(plan_id),
  step_number     INTEGER NOT NULL,
  discovery_id    TEXT REFERENCES study_discoveries(discovery_id),
  start_verse_id  INTEGER REFERENCES verses(verse_id),
  end_verse_id    INTEGER REFERENCES verses(verse_id),
  CHECK (
    (discovery_id IS NOT NULL AND start_verse_id IS NULL AND end_verse_id IS NULL)
    OR
    (discovery_id IS NULL AND start_verse_id IS NOT NULL AND end_verse_id IS NOT NULL
      AND end_verse_id >= start_verse_id)
  ),
  UNIQUE (plan_id, step_number)
);
```

A chronological plan requires a non-empty `chronology_note` naming the tradition or editorial
scheme and its source. It never stores a single uncontested year for a passage.

## 6. Reader state in `userdata.db`

Personal state remains outside the rebuildable corpus:

```sql
CREATE TABLE study_progress (
  user_id         TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  discovery_id    TEXT NOT NULL,
  last_stage      TEXT NOT NULL CHECK (last_stage IN ('read','notice','closer','ponder','finished')),
  started_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  completed_at    TEXT,
  active_seconds  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, discovery_id)
);

CREATE TABLE study_passage_views (
  user_id         TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  discovery_id    TEXT NOT NULL,
  start_verse_id  INTEGER NOT NULL,
  end_verse_id    INTEGER NOT NULL,
  first_seen_at   TEXT NOT NULL,
  last_seen_at    TEXT NOT NULL,
  PRIMARY KEY (user_id, discovery_id, start_verse_id, end_verse_id),
  CHECK (end_verse_id >= start_verse_id)
);

CREATE TABLE study_plan_progress (
  user_id         TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  plan_id         TEXT NOT NULL,
  current_step    INTEGER NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('active','paused','finished','left')),
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (user_id, plan_id)
);
```

SQLite cannot enforce foreign keys across database files, so `discovery_id` and `plan_id` are
validated in application code against `bible.db` on every write. Stale progress for editorially
withdrawn content remains retained for history but is not offered as a live link.

Progress mutations are optimistic only when they have exact rollback state. A failed write leaves
the current stage visible, restores the prior persisted state in the client, and presents a calm
inline error with Retry. The page never navigates away or celebrates completion until persistence
succeeds.

Passage visibility is recorded by intersecting `PassageRenderer`'s real verse elements with an
`IntersectionObserver`. A verse counts as viewed after at least half of its box is visible while
the document is foregrounded. Heartbeats accumulate only focused foreground time, cap any single
interval at 60 seconds, and stop on `visibilitychange`, page navigation, or loss of focus. The UI
still labels this evidence **viewed**, never **read** or **understood**.

## 7. Reminder design

### 7.1 Calendar

Reminder settings let the reader select a local time and download a recurring `.ics` event. The
event uses a floating local time so it remains at the chosen wall-clock time when the reader
travels, includes an `RRULE:FREQ=DAILY`, and links to `/study`. Calendar setup requires no account,
push subscription, or email address.

The interface describes calendar reminders accurately: Jot cannot suppress a calendar alert
after today's session is completed because the calendar owns the recurring event.

### 7.2 Device push

Push is strictly opt-in. Jot asks for permission only in direct response to **Enable daily
reminder**, never on page load or during the guided tour. On iPhone and iPad, the setup explains
that web push requires adding Jot as a Home Screen web app. This follows WebKit's documented Web
Push model: <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/>.

```sql
CREATE TABLE push_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  endpoint         TEXT NOT NULL UNIQUE,
  p256dh            TEXT NOT NULL,
  auth_secret       TEXT NOT NULL,
  timezone          TEXT NOT NULL,
  local_minute      INTEGER NOT NULL CHECK (local_minute BETWEEN 0 AND 1439),
  preview_mode      TEXT NOT NULL CHECK (preview_mode IN ('generic','title')) DEFAULT 'generic',
  enabled           INTEGER NOT NULL DEFAULT 1,
  last_sent_local_date TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE push_delivery_log (
  subscription_id TEXT NOT NULL REFERENCES push_subscriptions(subscription_id) ON DELETE CASCADE,
  local_date      TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('sent','suppressed','expired','failed')),
  attempted_at    TEXT NOT NULL,
  PRIMARY KEY (subscription_id, local_date)
);
```

A server-side reminder worker runs once per minute under a systemd timer on the single VPS. It:

1. Computes each enabled subscription's local date and minute from its IANA timezone.
2. Uses the unique delivery-log key for idempotency. `failed` rows may be updated and retried only
   within the bounded grace window; `sent`, `suppressed`, and `expired` rows are terminal.
3. Suppresses delivery when `study_progress.completed_at` covers that local date's discovery.
4. Sends either generic lock-screen copy (“Today's reading is ready”) or the discovery title,
   according to the reader's privacy preference.
5. Opens `/study` from the notification action.
6. Disables subscriptions whose push service reports permanent expiration.
7. Never logs endpoints, encryption keys, or payload secrets.

The push endpoint and keys are capability-bearing data. `userdata.db` keeps restrictive file
permissions; VAPID private material exists only in environment configuration. Unsubscribe deletes
the subscription row. Production activation of the systemd timer and VAPID keys requires a
separate human checkpoint after dry-run verification because it creates an outward-facing effect.

## 8. Rendering and interaction architecture

### 8.1 One renderer

`/study/[slug]` loads corpus content in its Server Component and passes passage rows, omissions,
apparatus, word focus, and literary structures to `PassageRenderer`. No study component imports
`lib/db/corpus`, `lib/db/apparatus`, or `lib/db/client`; no study component fetches `/api/passage`;
and no study surface imports `Verse` directly. Existing lint boundaries expand to enumerate these
routes around the single-renderer rule.

Literary structures extend the existing decoration pipeline:

- Desktop: margin labels and restrained bracket/connector treatments beside the affected verses.
- Narrow containers: compact A/B/center chips plus an ordered accessible outline below the
  structure heading; DOM order remains the reading order.
- Pairing is never communicated by color alone. Labels and `aria-describedby` text name the pair.
- Competing structures are a single mounted instance with a selector, not duplicated desktop and
  mobile renderers.
- Turning off the Literary structure layer removes the visible structure treatment while the
  study's plain-language Notice remains; a control must always move pixels.

### 8.2 Original words and translations

Word-focus cards reuse corpus queries and existing interlinear types. They show only tokens the
curated focus identifies, with a clear **See all original words** action that enables the normal
reader layer. Translation comparison uses the existing verse-aligned comparison rather than
concatenated snippets. Copyright notices remain attached to each translation's text.

### 8.3 State and navigation

- The route slug identifies content; local progress selects the resumable stage.
- Back/forward navigation updates the URL at meaningful stage boundaries and never traps the user
  in a client-only wizard history.
- The core scripture is present in the server-rendered response. JavaScript failure may remove
  progressive disclosure and progress writes, but never the day's passage.
- “Finish for today” returns to `/study`; “Keep reading” opens a canonical `/read/[ref]`, related
  discovery, or active plan step.

## 9. Accessibility and layperson clarity

- Primary labels are Read, Notice, Look closer, Ponder, Finish, Study, Original words, and Literary
  structure. Specialized terms always carry their global lexicon gloss.
- The page has one `h1`, and stage headings form a logical hierarchy without treating steps as
  modal screens.
- All core content is reachable without hover. Sources and glosses have focusable equivalents.
- Keyboard focus follows DOM order. No CSS `order` repositions interactive regions.
- Structure brackets, paired units, completion state, and notification status are not conveyed by
  color alone.
- Reminder setup uses the shared modal-surface behavior if presented modally: focus trap,
  background inerting, and focus restoration.
- The phone layout keeps Today's reading, Begin/Continue, and Finish within easy reach and never
  places the deeper apparatus before the core reading.
- Study controls meet the 44px coarse-pointer target without inserting layout width into scripture
  lines.
- Dates and reminder times are spoken with locale-aware accessible names; no calendar grid relies
  on abbreviation alone.
- All new text and controls meet WCAG AA contrast on every existing light and dark surface token.

## 10. Failure and empty states

- **Progress write fails:** restore prior progress, keep the session open, show Retry.
- **Daily schedule missing:** say “No new discovery was published today,” then offer the current
  plan and reader. Never silently repeat or return 404.
- **Curated word focus no longer resolves:** fail corpus ingest; never ship a blank word card.
- **A source URL is unavailable:** preserve the full bibliographic citation and locator. A link is
  optional; a citation is not.
- **Push unsupported:** retain calendar reminders and explain the device limitation in one
  sentence. Do not render a dead Enable control.
- **Push permission denied:** show instructions for changing browser/device settings and leave the
  calendar option available. Do not prompt again automatically.
- **Push delivery transiently fails:** keep the subscription, log a bounded failure, and retry only
  on the next worker pass within a short grace window. Permanent expiration disables it.
- **Timezone invalid:** reject the write and ask the client to re-detect or choose a timezone; do
  not guess silently for scheduled push.
- **Withdrawn discovery:** retain historical progress as plain text and remove navigation into the
  withdrawn card.

## 11. Ingest and integrity gates

The corpus build fails unless all of the following hold:

1. Every start and end id exists in `verses`, and every range expansion intersects the ordered
   real-verse set rather than incrementing encoded ids.
2. Every published discovery has a hook, Notice, takeaway, one to three questions, a reviewer, a
   review timestamp, and at least one scoped source.
3. Every interpretation has its own source.
4. Every word focus resolves to exactly one original token.
5. Every published-proposal structure has a source; every mechanically verified structure is an
   acrostic whose expected initials match recomputation from stored original words.
6. Structure units are in canonical reading order; each non-null pair key occurs exactly twice in
   mirrored order; each unit stays within its parent structure's real verse set.
7. Every published plan step resolves to a published discovery or a valid real-verse range.
8. Every chronological plan names and cites its chronology.
9. The schedule contains unique published discoveries for at least the next 60 consecutive local
   dates from the build date.
10. Every rolling 30 scheduled entries meets the book, genre, and insight-kind diversity floor.
11. Study tables and their content are included in the streamed content hash that produces
    `corpus_meta.build_id`; row ordering is semantic, never insertion order.

The validation path for structural pairing and schedule diversity must be independently expressed
from the loader rather than calling the loader's own helper, so a shared bug cannot certify itself.

## 12. Verification and acceptance criteria

Implementation is not complete until all existing gates and these feature-specific checks pass on
the VPS.

### Automated

- Unit tests for local-date resolution across UTC boundaries and daylight-saving transitions.
- Unit tests for schedule selection, missed days, unfinished sessions, withdrawn content, and
  exhaustion without repetition.
- Red/green tests for progress creation, update, exact rollback, and idempotent completion.
- Ingest tests that deliberately remove a real verse, source, paired unit, acrostic initial, word
  token, plan step, and scheduled date and prove each gate fails by name.
- Tests proving no study component bypasses `PassageRenderer` through direct corpus imports,
  `Verse` imports, or `/api/passage` fetches.
- Component tests for stage navigation, progressive disclosure, competing literary proposals,
  plain labels, and unsupported/denied notification states.
- `.ics` parser assertions for a daily recurrence, selected local time, stable `/study` URL, and
  escaped text.
- Push-worker tests for timezone selection, completion suppression, duplicate prevention, generic
  versus title preview, transient failure, and expired subscription cleanup.
- Service-worker tests proving a notification click focuses an existing Jot window or opens
  `/study` and that every received push produces a visible notification.
- Full `npm run build`, `npm run lint`, and `npm run test` gates through
  `scripts/sync-and-build.sh`.

### Rendered and manual

- Load `/`, `/study`, one session of each insight kind, a session with two competing chiasm
  proposals, reminder settings, study history, and schedule-exhaustion state.
- Capture all those states at 320, 390, 768, 1280, and 1920 pixels in light and dark themes.
- Run `scripts/measure.mjs`; confirm no horizontal overflow, intended reading measure, and the
  actual Literata/Hebrew faces.
- Run axe and keyboard checks, including focus order through the structure selector and reminder
  controls.
- On a coarse-pointer 390px device, confirm primary actions are reachable and scripture selection
  remains possible beside literary markers.
- Install the PWA on a supported phone, enable push through an explicit tap, receive a dry-run
  notification at the chosen time, open the correct day's session, complete it, and prove a second
  send for that local date is suppressed.
- Import the calendar event on a phone and confirm the chosen local time, daily recurrence, and
  deep link.
- Tear down every preview process, worker, timer, and temporary artifact created for verification.

## 13. Delivery boundaries

This scope is larger than one implementation chunk. The implementation plan must split it into
independently verifiable work in dependency order:

1. Corpus schema, loaders, editorial format, build hash, and integrity gates.
2. User progress schema and tested APIs.
3. Study workspace and daily-session shell using the one renderer.
4. Literary structures and original-word discovery components.
5. Plans, history, Continue reading, and home/navigation integration.
6. Calendar reminder and PWA installation surface.
7. Push registration, worker, privacy controls, and dry-run deployment wiring.
8. Curated catalog and scheduled editorial runway.
9. Full rendered verification, accessibility audit, documentation, and VPS cleanup.

Production push activation is explicitly outside automatic delivery: after dry-run evidence, the
operator reviews the stored-data shape, VAPID secret placement, systemd units, notification copy,
and rollback steps, then approves activation.
