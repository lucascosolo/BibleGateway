import { NextResponse } from "next/server";

import { getOutsideDocFacts, type OutsideDocFacts } from "@/app/_docs/outside-facts";

export const dynamic = "force-static";

const referenceParameter = {
  name: "ref",
  in: "query",
  required: true,
  description: "A canonical Jot reference, such as John 3:16 or John 3:16-18.",
  schema: { type: "string", example: "John 3:16" },
};

const translationParameter = {
  name: "translation",
  in: "query",
  description: "Translation code from /api/translations; defaults to WEB.",
  schema: { type: "string", default: "WEB", example: "KJV" },
};

const idParameter = (example: string) => ({ name: "id", in: "path", required: true, schema: { type: "string", example } });

const errorResponse = {
  description: "The request could not be resolved.",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
};

const jsonOf = (description: string, ref: string) => ({
  description,
  content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } },
});

const REVIEW_STATUS_NOTE =
  "`status` is the review grade: draft < sources-located < claims-checked < expert-reviewed. " +
  "Anything below claims-checked is UNCHECKED: its claims have not yet been verified against the cited sources, and a citing client must say so.";

const OUTSIDE_NOTE =
  "Outside books (ids 67-120) are not in the Hebrew or the Protestant canon. They fall in five canons: deuterocanon (read in Catholic and Orthodox Bibles, which differ on exactly which), " +
  "pseudepigrapha (1 Enoch and Jubilees are scripture only in the Ethiopian Orthodox Tewahedo Church), nt-apocrypha and apostolic (in no New Testament today), and described (no free translation; described, not printed). ";

const buildOpenapi = (facts: OutsideDocFacts) => ({
  openapi: "3.1.0",
  info: {
    title: "Jot read-only research API",
    version: "1",
    description:
      "Public, read-only access to Jot's canonical Bible corpus, research apparatus, historical timeline and audio timings. " +
      "The numeric verse_id (BBCCCVVV) is the stable address shared by every endpoint. Corpus, timeline and audio responses " +
      "carry an ETag derived from the build(s) they read and `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400`; " +
      "send If-None-Match to receive 304. Errors are JSON and are not cached.",
  },
  servers: [{ url: "/", description: "The Jot deployment serving this document" }],
  paths: {
    "/api/openapi.json": {
      get: { summary: "This OpenAPI 3.1 contract", responses: { "200": { description: "The contract." } } },
    },
    "/api/corpus": {
      get: {
        summary: "Identify the corpus and audio builds, count the verses, and list the outside books by canon",
        description:
          "`canonicalVerseCount` is 31,102, the 66-book address space. `outside.canons` has one entry per outside canon that has printed books (deuterocanon, pseudepigrapha, nt-apocrypha, apostolic; `described` works have work records but no book text, so no entry) with `books`, `verses` stored, and `bookList` (each book's `numbering` scheme and the `translations` that print it). The outside verses are never added to the 31,102. " + OUTSIDE_NOTE,
        responses: { "200": jsonOf("Content-derived build IDs and public source archive checksums.", "CorpusResponse") },
      },
    },
    "/api/passage": {
      get: {
        summary: "Read a translated passage with its omission apparatus and, optionally, translator footnotes",
        description:
          "Outside books resolve too: `ref=Thomas 42` (Gospel of Thomas, logion 42), `ref=Sir 1:1` (Sirach), `ref=Enoch 1:1`. `book` reports the book's `canon` and `numbering` scheme (chapter-verse, logion, section, chapter, part-chapter, paragraph, page); read the numbering before citing, because the unit is not always a verse (a logion, a manuscript page, an editorial ordinal). Use the translation that carries the book (see `books` in /api/translations); an outside book in WEB is a 404. " + OUTSIDE_NOTE,
        parameters: [
          referenceParameter,
          { ...translationParameter, description: "Translation code from /api/translations; defaults to WEB. Outside books need a translation that prints them, such as KJVA (Apocrypha), CHARLES, GRAY, MATTISON, ANF, JAMES1924 or LIGHTFOOT.", schema: { type: "string", default: "WEB", example: "MATTISON" } },
          { name: "t", in: "query", description: "Alias for `translation`, as in reader URLs. `translation` wins when both are given.", schema: { type: "string", example: "LXX" } },
          { name: "footnotes", in: "query", description: "`1` adds `footnotes`: the translation's own notes on the returned verses. Off by default so the payload shape is stable. Any value other than 0 or 1 is a 400.", schema: { type: "string", enum: ["0", "1"], default: "0" } },
        ],
        responses: {
          "200": jsonOf("Passage, omission apparatus, and footnotes when requested. A reference the translation does not print but records as omitted is a 200 with an empty `verses` and a populated `omissions`.", "PassageResponse"),
          "400": errorResponse,
          "404": errorResponse,
        },
      },
    },
    "/api/originals": {
      get: {
        summary: "Read original-language data and apparatus",
        parameters: [referenceParameter],
        responses: { "200": jsonOf("Word-level originals, morphology, variants, and selected witness readings.", "OriginalsResponse"), "400": errorResponse },
      },
    },
    "/api/search": {
      get: {
        summary: "Search translation text",
        description: "Example: `/api/search?q=kingdom&canon=all&translation=MATTISON` searches the Gospel of Thomas and its siblings as well as the 66. The response echoes `canon`.",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string", example: "grace" } },
          translationParameter,
          { name: "testament", in: "query", schema: { type: "string", enum: ["OT", "NT", "DC"] } },
          { name: "book", in: "query", description: "Numeric book id (1-66; any book id when canon=all).", schema: { type: "integer", example: 45 } },
          { name: "canon", in: "query", description: "`bible` (default) searches only the 66 books of the Hebrew and Protestant canon; `all` also searches the outside books (ids 67-120), which then carry `canon` in their hits. Anything else is read as `bible`. An outside `book` id implies `all`. Search the translation that prints the book, e.g. `translation=KJVA`.", schema: { type: "string", enum: ["bible", "all"], default: "bible" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: { "200": { description: "Hits with `total`, `returned`, `limit`, `offset` and the book distribution." }, "400": errorResponse, "404": errorResponse },
      },
    },
    "/api/original-search": {
      get: {
        summary: "Search original-language words",
        parameters: [
          { name: "q", in: "query", required: true, description: "A lemma, surface form, or Strong's key.", schema: { type: "string", example: "agape" } },
          { name: "language", in: "query", schema: { type: "string", enum: ["hbo", "arc", "grc"] } },
          { name: "morph", in: "query", description: "Prefix of the source morphology code.", schema: { type: "string", example: "V" } },
          translationParameter,
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: { "200": { description: "Verse-level results with the matching token, lemma, morphology, and book distribution." }, "400": errorResponse, "404": errorResponse },
      },
    },
    "/api/xrefs": {
      get: {
        summary: "Read ranked cross-references",
        parameters: [
          referenceParameter,
          translationParameter,
          { name: "minVotes", in: "query", schema: { type: "integer", default: 0 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 40 } },
        ],
        responses: { "200": { description: "Inbound and outbound references with totals, overlap disclosure and caps." }, "400": errorResponse },
      },
    },
    "/api/graph": {
      get: {
        summary: "Read a capped reference graph",
        parameters: [
          referenceParameter,
          { name: "depth", in: "query", schema: { type: "integer", minimum: 1, maximum: 3, default: 2 } },
          { name: "maxDegree", in: "query", schema: { type: "integer", minimum: 1, maximum: 30, default: 12 } },
          { name: "maxNodes", in: "query", schema: { type: "integer", minimum: 1, maximum: 150, default: 60 } },
          { name: "minVotes", in: "query", schema: { type: "integer", minimum: 0, default: 1 } },
        ],
        responses: { "200": { description: "Graph nodes, edges, and cap disclosure." }, "400": errorResponse },
      },
    },
    "/api/translations": {
      get: {
        summary: "List translation metadata",
        description: "Codes, licensing, attribution, scope and `scopeNote`. A partial edition (such as LXX, Brenton's Septuagint) states which books it prints and why the others are withheld. The seven outside-book editions have `scope: \"outside\"` (KJVA, CHARLES, GRAY, MATTISON, ANF, JAMES1924, LIGHTFOOT) and carry a `books` list (`bookId`, `osisId`, `name`, `canon`, `numbering`) naming every book they print. Each one's `license` is its basis in the source ledger (age of publication and the translator's death year, a source's own public-domain statement, or the translator's dedication); its `copyrightNotice` says whether it was proofread against the printed pages (CHARLES's Testaments and 2 Baruch and GRAY were, in 2026). Quote the notice with the text.",
        responses: { "200": { description: "Translation codes, scope, licensing, and attribution." } },
      },
    },
    "/api/concordance": {
      get: {
        summary: "Export a bounded concordance",
        parameters: [
          { name: "key", in: "query", required: true, description: "A Strong's key or exact original-language lemma.", schema: { type: "string", example: "H2617a" } },
          { name: "format", in: "query", schema: { type: "string", enum: ["tsv"], default: "tsv" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 5000, default: 5000 } },
        ],
        responses: { "200": { description: "A UTF-8 TSV download. X-Total-Count and X-Export-Truncated disclose the complete total and any cap." }, "400": errorResponse, "404": errorResponse },
      },
    },
    "/api/audio/passage": {
      get: {
        summary: "Audio recordings and verse/word timing metadata for one chapter",
        description:
          "Recordings of exactly one chapter in every available audio edition (e.g. BSB-souer, WEB-williams, KJV-librivox, WLC-beeri), with each verse's start/end in milliseconds within the chapter file. No verse text. A ref spanning more than one chapter is a 400; a chapter with no recording is a 404.",
        parameters: [
          referenceParameter,
          { name: "t", in: "query", description: "Translation code the reader is showing; selects `nextHref` and `translationCode`. Defaults to WEB.", schema: { type: "string", default: "WEB" } },
        ],
        responses: { "200": jsonOf("The chapter's recordings and timings.", "AudioPassageResponse"), "400": errorResponse, "404": errorResponse },
      },
    },
    "/api/timeline": {
      get: {
        summary: "List timeline events and eras in a window of years",
        description:
          "Years are integers: negative = BCE, positive = CE, no year 0. Every event is a range (the envelope of its archaeological, critical and chronological positions on the event's own date; traditional chronology counts only when it is the sole position), never a point, with `traditional` giving the separate envelope of its traditional-chronology positions, or null, with a confidence and a review status. " +
          REVIEW_STATUS_NOTE +
          " Events are returned in `tracks`, one list per axis — narrative (when events happened), composition (when texts were written), canon (when collections were recognised as scripture) — never merged into one list; `axis` fills only that track. `available` is false when no timeline is deployed.",
        parameters: [
          { name: "from", in: "query", schema: { type: "integer", default: -4000, example: -1500 } },
          { name: "to", in: "query", schema: { type: "integer", default: 400, example: -500 } },
          { name: "axis", in: "query", schema: { type: "string", enum: ["narrative", "composition", "canon"] } },
        ],
        responses: { "200": { description: "Overlapping eras, and events grouped by axis in `tracks`, earliest first." }, "400": errorResponse },
      },
    },
    "/api/timeline/events/{id}": {
      get: {
        summary: "Read one timeline event: positions, arguments, attestations and issues",
        description:
          "Each position on the date with its range, tradition and holders (`tradition` is archaeological, critical, chronological or traditional; traditional chronology adds up the Bible's own numbers and is a lens, not evidence). Positions whose `dates` is `event` are in `positions` and alone make the envelope; positions whose `dates` is `composition` date the writing of the story, not the event, and are in `compositionPositions`. Each position carries cited arguments for and against it; `attestations` are sources outside the Bible that corroborate the event, are consistent with it, are silent, or are in tension with it. " +
          REVIEW_STATUS_NOTE,
        parameters: [idParameter("exodus")],
        responses: { "200": jsonOf("The event in full, with citations.", "TimelineEvent"), "404": errorResponse },
      },
    },
    "/api/timeline/artifacts/{id}": {
      get: {
        summary: "Read an artifact from outside the Bible (inscription, chronicle, relief…)",
        description: "Where it is held, what it says, and the events it bears on. `made` is null when the object's own date is not established. " + REVIEW_STATUS_NOTE,
        parameters: [idParameter("babylonian-chronicle-abc5")],
        responses: { "200": { description: "The artifact with its attestations and citations." }, "404": errorResponse },
      },
    },
    "/api/timeline/issues/{id}": {
      get: {
        summary: "Read a chronological, textual or historical issue and its scholarly views",
        description: REVIEW_STATUS_NOTE,
        parameters: [idParameter("exodus-480-years")],
        responses: { "200": { description: "The issue, each view with citations, and the events it concerns." }, "404": errorResponse },
      },
    },
    "/api/timeline/passage": {
      get: {
        summary: "Find the timeline events, issues, artifacts, people and investigations that bear on a passage",
        parameters: [referenceParameter],
        description:
          "`notes` lists one entry per verse link intersecting the passage, deduplicated per subject per anchor verse: `anchor` (the link's first verse, clamped into the passage), `start`/`end` (the full link), `linkType`, the link's own `note`, and a `subject` carrying what the reader's margin sentence is built from (event positions and confidence, issue kind, person evidence grade and tension, an artifact's strongest `relation`, or an investigation's witness and explanation counts), each with its review `status`.",
        responses: { "200": { description: "Events the passage describes or helps date, issues it raises, artifacts linked to it, people it names, and the reader's timeline notes." }, "400": errorResponse },
      },
    },
    "/api/timeline/persons": {
      get: {
        summary: "List biblical figures with their evidence grade",
        description:
          "Each person's `evidence` grade is derived from their attestations outside the Bible, never typed by hand: corroborates > partially-corroborates > consistent > silent > none. `hasTension` is true when at least one outside source contradicts a biblical detail about them. " +
          REVIEW_STATUS_NOTE,
        responses: { "200": { description: "People, earliest first, with evidence grade, tension flag, status and href." } },
      },
    },
    "/api/timeline/persons/{id}": {
      get: {
        summary: "Read one biblical figure: every outside source that names, fits or contradicts them",
        description:
          "Attestations with their relation (corroborates, partially-corroborates, consistent, silent, in-tension) and cited notes, the events and issues the person is linked to, and the verses that name them.",
        parameters: [idParameter("hezekiah")],
        responses: { "200": { description: "The person in full, with citations." }, "404": errorResponse },
      },
    },
    "/api/timeline/investigations": {
      get: {
        summary: "List textual investigations",
        description: "One passage whose ancient witnesses read differently, with counts of witnesses and cited differences. " + REVIEW_STATUS_NOTE,
        responses: { "200": jsonOf("Every investigation with its passage and href.", "InvestigationList") },
      },
    },
    "/api/timeline/investigations/{id}": {
      get: {
        summary: "Read one textual investigation: witnesses, editions, differences and challenges",
        description:
          "Each witness's reading (original language and English) with citations; which printed editions follow which witness (`follows` is a witness siglum); each difference with its `kind` and `heldBy` (the scholar or tradition who holds that explanation) and citations; and cited challenges to the investigation's conclusions. " +
          REVIEW_STATUS_NOTE,
        parameters: [idParameter("deut-32-8-9")],
        responses: { "200": jsonOf("The investigation in full, with citations.", "InvestigationDetail"), "404": errorResponse },
      },
    },
    "/api/timeline/works": {
      get: {
        summary: "List the outside-book work records (Chitzonim), filterable by canon",
        description:
          facts.workCount + " works across five canons, in the order deuterocanon, pseudepigrapha, nt-apocrypha, apostolic, described. `composed` is the derived envelope of the scholarly dating positions as a range with `display`, or null. " + facts.undatedWord + " works are explicitly undated: for them `composed` is null and `composedUndated` states why and what is known (for example the earliest dated copy). Never supply a date for an undated work. `traditional` is the separate traditional-chronology envelope, or null. Each work lists its `books` and an `href` (this API) and `page` (the human page under /chitzonim/works). " +
          OUTSIDE_NOTE + REVIEW_STATUS_NOTE,
        parameters: [
          { name: "canon", in: "query", description: "Only works of this canon. Omit for all five. An unknown value is a 400.", schema: { type: "string", enum: ["deuterocanon", "pseudepigrapha", "nt-apocrypha", "apostolic", "described"], example: "nt-apocrypha" } },
        ],
        responses: { "200": jsonOf("Works with total, the canon filter used, and each work's dating or its stated reason for having none.", "WorkList"), "400": errorResponse },
      },
    },
    "/api/timeline/works/{id}": {
      get: {
        summary: "Read one outside-book work: dating positions, witnesses, who reads it as scripture, translations",
        description:
          "`positions` are the cited scholarly dating positions with who holds each; `composed`/`composedUndated` are as in the list. `witnesses` are surviving copies (manuscript, date range, institution); `heldCanonicalBy` names the traditions that read it as scripture (empty for most); `translations` names the ledger entries and codes that print it; `excerpts` are short cited quotations (the only text of a `described` work); `verses` link it to Bible passages. " + REVIEW_STATUS_NOTE,
        parameters: [idParameter("gospel-of-thomas")],
        responses: { "200": jsonOf("The work in full, with citations.", "WorkDetail"), "404": errorResponse },
      },
    },
    "/api/annotations": {
      get: {
        summary: "PRIVATE: the signed-in user's annotations in a verse-id range",
        description: "User-scoped and never cached (`Cache-Control: private, no-store`). Not part of the public research API; do not call it from unauthenticated clients.",
        parameters: [
          { name: "start", in: "query", required: true, schema: { $ref: "#/components/schemas/VerseId" } },
          { name: "end", in: "query", required: true, schema: { $ref: "#/components/schemas/VerseId" } },
        ],
        responses: { "200": { description: "The user's annotations overlapping the range." }, "400": errorResponse },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: { error: { type: "string" }, available: { type: "array", items: { type: "string" } } },
      },
      VerseId: {
        type: "integer",
        description: "Canonical BBCCCVVV address. This is the only cross-surface verse address. The space is sparse: never subtract ids to measure distance.",
        example: 43003016,
      },
      Range: {
        type: "object",
        required: ["start", "end"],
        properties: { start: { $ref: "#/components/schemas/VerseId" }, end: { $ref: "#/components/schemas/VerseId" } },
      },
      ReviewStatus: {
        type: "string",
        enum: ["draft", "sources-located", "claims-checked", "expert-reviewed"],
        description: "Ordered review grade. draft and sources-located are UNCHECKED; claims-checked and expert-reviewed are checked.",
      },
      Citation: {
        type: "object",
        properties: {
          sourceId: { type: "string" }, kind: { type: "string" }, title: { type: "string" }, author: { type: ["string", "null"] },
          container: { type: ["string", "null"] }, publisher: { type: ["string", "null"] }, year: { type: ["integer", "null"] },
          url: { type: ["string", "null"] }, locator: { type: ["string", "null"] },
        },
      },
      CorpusResponse: {
        type: "object",
        required: ["buildId", "audioBuildId", "canonicalVerseCount", "outside", "sources"],
        properties: {
          buildId: { type: "string", description: "Content-derived id of bible.db." },
          audioBuildId: { type: ["string", "null"], description: "Content-derived id of the audio artifact; null when this deployment has none." },
          canonicalVerseCount: { type: "integer", example: 31102, description: "Verses in the 66-book address space." },
          outside: {
            type: "object",
            properties: {
              canons: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    canon: { type: "string", enum: ["deuterocanon", "pseudepigrapha", "nt-apocrypha", "apostolic", "described"] },
                    books: { type: "integer" }, verses: { type: "integer" },
                    bookList: { type: "array", items: { type: "object", properties: { bookId: { type: "integer" }, osisId: { type: "string" }, name: { type: "string" }, numbering: { type: "string", enum: ["chapter-verse", "logion", "section", "chapter", "part-chapter", "paragraph", "page"] }, verses: { type: "integer" }, translations: { type: "array", items: { type: "string" } } } } },
                  },
                },
              },
            },
          },
          sources: { type: "array", items: { type: "object", description: "Upstream archive: URL, filename, SHA-256." } },
        },
      },
      Verse: {
        type: "object",
        required: ["verseId", "chapter", "verse", "text"],
        properties: {
          verseId: { $ref: "#/components/schemas/VerseId" }, chapter: { type: "integer" }, verse: { type: "integer" },
          text: { type: "string", description: "Plain, NFC-normalized text with no markup or footnote callers." },
          heatBucket: { type: "integer", description: "Cross-reference density bucket." },
        },
      },
      Omission: {
        type: "object",
        required: ["verseId", "verse", "kind", "reason", "history", "printedBy"],
        properties: {
          verseId: { $ref: "#/components/schemas/VerseId" },
          verse: { type: "integer" },
          kind: {
            type: "string",
            enum: ["critical-text", "versification", "coverage", "unexplained"],
            description:
              "critical-text: absent from the earliest manuscripts and omitted by critical-text editions. versification: the edition numbers its verses differently and has no verse at this canonical address. coverage: reserved for a whole book outside the edition's scope; book scope is reported by /api/translations and normally not written per verse. unexplained: no recorded cause.",
          },
          reason: { type: "string" },
          history: { type: "string", description: "Reader-facing transmission history; does not claim an exact insertion date. Empty for non-textual kinds." },
          printedBy: { type: "array", items: { type: "object", properties: { code: { type: "string" }, name: { type: "string" } } } },
        },
      },
      Footnote: {
        type: "object",
        required: ["verseId", "noteOrder", "caller", "kind", "text"],
        properties: {
          verseId: { $ref: "#/components/schemas/VerseId" },
          noteOrder: { type: "integer", description: "Printed order within the verse." },
          caller: { type: ["string", "null"], description: "The mark the publisher printed, if any." },
          kind: { type: "string", enum: ["footnote", "endnote", "crossref"] },
          text: { type: "string" },
        },
      },
      PassageResponse: {
        type: "object",
        required: ["reference", "range", "translation", "verses", "omissions"],
        properties: {
          reference: { type: "string" },
          range: { $ref: "#/components/schemas/Range" },
          translation: { type: "object", properties: { code: { type: "string" }, name: { type: "string" }, copyright: { type: "string" } } },
          book: { type: ["object", "null"], description: "The first book of the range: its canon and numbering scheme.", properties: { bookId: { type: "integer" }, osisId: { type: "string" }, canon: { type: "string" }, numbering: { type: "string", enum: ["chapter-verse", "logion", "section", "chapter", "part-chapter", "paragraph", "page"] } } },
          verses: { type: "array", items: { $ref: "#/components/schemas/Verse" } },
          omissions: { type: "array", items: { $ref: "#/components/schemas/Omission" } },
          footnotes: { type: "array", items: { $ref: "#/components/schemas/Footnote" }, description: "Present only with footnotes=1; the requested translation's notes on the returned verses, in verse then printed order." },
        },
      },
      OriginalsResponse: {
        type: "object",
        required: ["reference", "range", "sources", "words", "qereReadings", "greekEditionVariants", "greekManuscriptReadings"],
        properties: {
          reference: { type: "string" },
          range: { $ref: "#/components/schemas/Range" },
          sources: { type: "array", items: { $ref: "#/components/schemas/Source" } },
          words: { type: "array", items: { type: "object" } },
          qereReadings: { type: "array", items: { type: "object" } },
          greekEditionVariants: { type: "array", items: { type: "object" } },
          greekManuscriptReadings: { type: "array", items: { type: "object" } },
        },
      },
      Source: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" }, license: { type: "string" }, url: { type: "string", format: "uri" } },
      },
      AudioEdition: {
        type: "object",
        properties: {
          code: { type: "string", example: "KJV-librivox" }, translationCode: { type: ["string", "null"], description: "Null for an original-language reading." },
          language: { type: "string" }, name: { type: "string" }, reader: { type: "string" }, license: { type: "string" },
          attribution: { type: "string" }, sourceUrl: { type: "string" }, pronunciationNote: { type: ["string", "null"] },
        },
      },
      ChapterAudio: {
        type: "object",
        properties: {
          editionCode: { type: "string" }, bookId: { type: "integer" }, chapter: { type: "integer" },
          url: { type: "string", description: "App-relative file URL, versioned by the audio build id." },
          durationMs: { type: "integer" },
          verses: { type: "array", items: { type: "object", properties: { verseId: { $ref: "#/components/schemas/VerseId" }, startMs: { type: "integer" }, endMs: { type: "integer" } } } },
        },
      },
      AudioPassageResponse: {
        type: "object",
        required: ["slug", "label", "translationCode", "renderedVerseIds", "nextHref", "audio"],
        properties: {
          slug: { type: "string" }, label: { type: "string" }, bookName: { type: "string" }, translationCode: { type: "string" },
          renderedVerseIds: { type: "array", items: { $ref: "#/components/schemas/VerseId" } },
          nextHref: { type: ["string", "null"], description: "Reader path of the next chapter, null at the end of a book." },
          audio: {
            type: "object",
            properties: {
              editions: { type: "array", items: { $ref: "#/components/schemas/AudioEdition" } },
              chapters: {
                type: "array",
                items: { type: "object", properties: { bookId: { type: "integer" }, chapter: { type: "integer" }, byEdition: { type: "object", additionalProperties: { $ref: "#/components/schemas/ChapterAudio" }, description: "Keyed by edition code; an edition without this chapter is absent." } } },
              },
            },
          },
        },
      },
      Position: {
        type: "object",
        properties: {
          id: { type: "string" }, label: { type: "string" }, tradition: { type: "string", description: "archaeological, critical, chronological or traditional; traditional chronology is a lens, not evidence." },
          earliest: { type: "integer" }, latest: { type: "integer" }, display: { type: "string" }, summary: { type: "string" }, heldBy: { type: ["string", "null"] },
          citations: { type: "array", items: { $ref: "#/components/schemas/Citation" } },
          arguments: { type: "array", items: { type: "object", properties: { id: { type: "string" }, stance: { type: "string", enum: ["for", "against"] }, text: { type: "string" }, citations: { type: "array", items: { $ref: "#/components/schemas/Citation" } } } } },
        },
      },
      TimelineEvent: {
        type: "object",
        properties: {
          id: { type: "string" }, title: { type: "string" }, axis: { type: "string", enum: ["narrative", "composition", "canon"] },
          confidence: { type: "string", enum: ["firm", "contested", "speculative"] }, status: { $ref: "#/components/schemas/ReviewStatus" },
          earliest: { type: "integer" }, latest: { type: "integer" }, display: { type: "string" },
          traditional: { type: ["object", "null"], properties: { earliest: { type: "integer" }, latest: { type: "integer" } } },
          positions: { type: "array", items: { $ref: "#/components/schemas/Position" }, description: "Positions with dates=event; these alone make the envelope." },
          compositionPositions: { type: "array", items: { $ref: "#/components/schemas/Position" }, description: "Positions with dates=composition: when the story was written, not when the event happened." },
          attestations: { type: "array", items: { type: "object" } },
          issues: { type: "array", items: { type: "object" } },
        },
      },
      WorkSummary: {
        type: "object",
        required: ["id", "title", "canon", "status", "composed", "composedUndated", "books", "href", "page"],
        properties: {
          id: { type: "string" }, title: { type: "string" },
          canon: { type: "string", enum: ["deuterocanon", "pseudepigrapha", "nt-apocrypha", "apostolic", "described"] },
          status: { $ref: "#/components/schemas/ReviewStatus" },
          composed: { type: ["object", "null"], description: "Derived envelope of the dating positions; null exactly when composedUndated is set.", properties: { earliest: { type: "integer" }, latest: { type: "integer" }, display: { type: "string" } } },
          composedUndated: { type: ["string", "null"], description: "Why the work is undated and what is known; set exactly when composed is null. No range is ever invented." },
          traditional: { type: ["object", "null"], properties: { earliest: { type: "integer" }, latest: { type: "integer" }, display: { type: "string" } } },
          books: { type: "array", items: { type: "object", properties: { bookId: { type: "integer" }, osisId: { type: "string" }, name: { type: "string" } } } },
          href: { type: "string" }, page: { type: "string", description: "Human page, /chitzonim/works/{id}." },
        },
      },
      WorkList: {
        type: "object",
        properties: { canon: { type: ["string", "null"] }, total: { type: "integer" }, works: { type: "array", items: { $ref: "#/components/schemas/WorkSummary" } } },
      },
      WorkDetail: {
        allOf: [
          { $ref: "#/components/schemas/WorkSummary" },
          {
            type: "object",
            properties: {
              alsoKnownAs: { type: "array", items: { type: "string" } }, summary: { type: "string" }, contents: { type: ["string", "null"] }, originalLanguage: { type: "string" },
              citations: { type: "array", items: { $ref: "#/components/schemas/Citation" } },
              positions: { type: "array", items: { $ref: "#/components/schemas/Position" } },
              provenance: { type: "array", items: { type: "object" } },
              witnesses: { type: "array", items: { type: "object" } },
              heldCanonicalBy: { type: "array", items: { type: "object", properties: { tradition: { type: "string" }, note: { type: ["string", "null"] } } } },
              translations: { type: "array", items: { type: "object", properties: { ledger: { type: "string" }, code: { type: ["string", "null"] }, note: { type: ["string", "null"] } } } },
              excerpts: { type: "array", items: { type: "object" } },
              events: { type: "array", items: { type: "object" } },
              verses: { type: "array", items: { type: "object", properties: { start: { $ref: "#/components/schemas/VerseId" }, end: { $ref: "#/components/schemas/VerseId" }, linkType: { type: "string" }, note: { type: ["string", "null"] }, label: { type: "string" }, path: { type: "string" } } } },
            },
          },
        ],
      },
      InvestigationPassage: {
        type: "object",
        properties: { start: { $ref: "#/components/schemas/VerseId" }, end: { $ref: "#/components/schemas/VerseId" }, label: { type: "string" }, path: { type: "string" } },
      },
      InvestigationSummary: {
        type: "object",
        required: ["id", "title", "status", "gist", "start", "end", "witnessCount", "differenceCount", "passage", "href"],
        properties: {
          id: { type: "string" }, title: { type: "string" }, status: { $ref: "#/components/schemas/ReviewStatus" }, gist: { type: "string" },
          start: { $ref: "#/components/schemas/VerseId" }, end: { $ref: "#/components/schemas/VerseId" },
          witnessCount: { type: "integer" }, differenceCount: { type: "integer" },
          passage: { $ref: "#/components/schemas/InvestigationPassage" }, href: { type: "string" },
        },
      },
      InvestigationList: {
        type: "object",
        properties: { investigations: { type: "array", items: { $ref: "#/components/schemas/InvestigationSummary" } } },
      },
      InvestigationDetail: {
        allOf: [
          { $ref: "#/components/schemas/InvestigationSummary" },
          {
            type: "object",
            properties: {
              summary: { type: "string" },
              page: { type: "string", description: "Human page for the investigation." },
              witnesses: { type: "array", items: { type: "object", properties: { id: { type: "string" }, siglum: { type: "string" }, name: { type: "string" }, reading: { type: "string" }, translation: { type: "string" }, language: { type: "string" }, note: { type: ["string", "null"] }, citations: { type: "array", items: { $ref: "#/components/schemas/Citation" } } } } },
              editions: { type: "array", items: { type: "object", properties: { code: { type: "string", description: "Translation code." }, follows: { type: "string", description: "Siglum of the witness this edition follows here." } } } },
              differences: { type: "array", items: { type: "object", properties: { id: { type: "string" }, kind: { type: "string", enum: ["textual", "lexical", "grammatical", "stylistic", "interpretive", "editorial"] }, text: { type: "string" }, heldBy: { type: ["string", "null"] }, citations: { type: "array", items: { $ref: "#/components/schemas/Citation" } } } } },
              challenges: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, citations: { type: "array", items: { $ref: "#/components/schemas/Citation" } } } } },
            },
          },
        ],
      },
    },
  },
});

export async function GET() {
  return NextResponse.json(buildOpenapi(getOutsideDocFacts()), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
