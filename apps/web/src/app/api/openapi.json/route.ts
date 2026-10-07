import { NextResponse } from "next/server";

export const dynamic = "force-static";

const referenceParameter = {
  name: "ref",
  in: "query",
  required: true,
  description: "A canonical Jot reference, such as John 3:16 or John 3:16-18.",
  schema: { type: "string", example: "John 3:16" },
};

const errorResponse = {
  description: "The request could not be resolved.",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
};

const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Jot read-only research API",
    version: "1",
    description:
      "Public, read-only access to Jot's canonical Bible corpus and research apparatus. " +
      "The numeric verse_id (BBCCCVVV) is the stable address shared by every endpoint.",
  },
  servers: [{ url: "/", description: "The Jot deployment serving this document" }],
  paths: {
    "/api/corpus": {
      get: {
        summary: "Identify the corpus build and upstream inputs",
        responses: { "200": { description: "Content-derived build ID and public source archive checksums." } },
      },
    },
    "/api/passage": {
      get: {
        summary: "Read a translated passage",
        parameters: [referenceParameter, { name: "translation", in: "query", description: "Translation code; defaults to WEB.", schema: { type: "string", default: "WEB", example: "KJV" } }],
        responses: { "200": { description: "Passage and omission apparatus.", content: { "application/json": { schema: { $ref: "#/components/schemas/PassageResponse" } } } }, "400": errorResponse, "404": errorResponse },
      },
    },
    "/api/originals": {
      get: {
        summary: "Read original-language data and apparatus",
        parameters: [referenceParameter],
        responses: { "200": { description: "Word-level originals, morphology, variants, and selected witness readings.", content: { "application/json": { schema: { $ref: "#/components/schemas/OriginalsResponse" } } } }, "400": errorResponse },
      },
    },
    "/api/search": {
      get: {
        summary: "Search the corpus",
        parameters: [{ name: "q", in: "query", required: true, schema: { type: "string", example: "grace" } }, { name: "translation", in: "query", schema: { type: "string", default: "WEB" } }, { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } }],
        responses: { "200": { description: "Paged search results and totals.", content: { "application/json": { schema: { type: "object", description: "Search result envelope; fields are stable within API version 1." } } } }, "400": errorResponse },
      },
    },
    "/api/original-search": {
      get: {
        summary: "Search original-language words",
        parameters: [{ name: "q", in: "query", required: true, description: "A lemma, surface form, or Strong's key.", schema: { type: "string", example: "agape" } }, { name: "language", in: "query", schema: { type: "string", enum: ["hbo", "arc", "grc"] } }, { name: "morph", in: "query", description: "Prefix of the source morphology code.", schema: { type: "string", example: "V" } }, { name: "translation", in: "query", schema: { type: "string", default: "WEB" } }],
        responses: { "200": { description: "Verse-level results with the matching token, lemma, morphology, and book distribution." }, "400": errorResponse, "404": errorResponse },
      },
    },
    "/api/xrefs": {
      get: {
        summary: "Read ranked cross-references",
        parameters: [referenceParameter, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 40 } }],
        responses: { "200": { description: "Inbound and outbound references with totals." }, "400": errorResponse },
      },
    },
    "/api/graph": {
      get: {
        summary: "Read a capped reference graph",
        parameters: [referenceParameter, { name: "depth", in: "query", schema: { type: "integer", minimum: 1, maximum: 4, default: 2 } }],
        responses: { "200": { description: "Graph nodes, edges, and cap disclosure." }, "400": errorResponse },
      },
    },
    "/api/translations": {
      get: {
        summary: "List translation metadata",
        responses: { "200": { description: "Translation codes, scope, licensing, and attribution." } },
      },
    },
    "/api/concordance": {
      get: {
        summary: "Export a bounded concordance",
        parameters: [{ name: "key", in: "query", required: true, description: "A Strong's key or exact original-language lemma.", schema: { type: "string", example: "H2617a" } }, { name: "format", in: "query", schema: { type: "string", enum: ["tsv"], default: "tsv" } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 5000, default: 5000 } }],
        responses: { "200": { description: "A UTF-8 TSV download. X-Total-Count and X-Export-Truncated disclose the complete total and any cap." }, "400": errorResponse, "404": errorResponse },
      },
    },
    "/api/timeline": {
      get: {
        summary: "List timeline events and eras in a window of years",
        description:
          "Years are integers: negative = BCE, positive = CE, no year 0. Every event is a range (the envelope of its archaeological, critical and chronological positions; traditional chronology counts only when it is the sole position), never a point, with `traditional` giving the separate envelope of its traditional-chronology positions, or null, with a confidence and a review status ('draft' until a human has reviewed it). Events are returned in `tracks`, one list per axis — narrative (when events happened), composition (when texts were written), canon (when collections were recognised) — never merged into one list; `axis` fills only that track. `available` is false when no timeline is deployed.",
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
          "Each position on the date with its range, tradition and holders (`tradition` is archaeological, critical, chronological or traditional; traditional chronology adds up the Bible's own numbers and is a lens, not evidence, and its envelope is in `traditional`, null when there is none; `earliest`/`latest` exclude it unless it is the only position), the cited arguments for and against it, the sources outside the Bible that corroborate it, are consistent with it, are silent, or are in tension with it, and the linked chronological and historical issues.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "exodus" } }],
        responses: { "200": { description: "The event in full, with citations." }, "404": errorResponse },
      },
    },
    "/api/timeline/artifacts/{id}": {
      get: {
        summary: "Read an artifact from outside the Bible (inscription, chronicle, relief…)",
        description: "Where it is held, what it says, and the events it bears on. `made` is null when the object's own date is not established.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "babylonian-chronicle-abc5" } }],
        responses: { "200": { description: "The artifact with its attestations and citations." }, "404": errorResponse },
      },
    },
    "/api/timeline/issues/{id}": {
      get: {
        summary: "Read a chronological, textual or historical issue and its scholarly views",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "exodus-480-years" } }],
        responses: { "200": { description: "The issue, each view with citations, and the events it concerns." }, "404": errorResponse },
      },
    },
    "/api/timeline/passage": {
      get: {
        summary: "Find the timeline events, issues, artifacts and people that bear on a passage",
        parameters: [referenceParameter],
        description:
          "`notes` lists one entry per verse link intersecting the passage, deduplicated per subject per anchor verse: `anchor` (the link's first verse, clamped into the passage), `start`/`end` (the full link), `linkType`, the link's own `note`, and a `subject` carrying what the reader's margin sentence is built from (event positions and confidence, issue kind, person evidence grade and tension, or an artifact's strongest `relation` to a person or event linked to the same verse).",
        responses: { "200": { description: "Events the passage describes or helps date, issues it raises, artifacts linked to it, people it names, and the reader's timeline notes." }, "400": errorResponse },
      },
    },
    "/api/timeline/persons": {
      get: {
        summary: "List biblical figures with their evidence grade",
        description:
          "Each person's `evidence` grade is derived from their attestations outside the Bible, never typed by hand: corroborates > partially-corroborates > consistent > silent > none. `has_tension` is true when at least one outside source contradicts a biblical detail about them. Every entry carries a review status ('draft' until a human has reviewed it).",
        responses: { "200": { description: "People, earliest first, with evidence grade, tension flag and status." } },
      },
    },
    "/api/timeline/persons/{id}": {
      get: {
        summary: "Read one biblical figure: every outside source that names, fits or contradicts them",
        description:
          "Attestations with their relation (corroborates, partially-corroborates, consistent, silent, in-tension) and cited notes, the events and issues the person is linked to, and the verses that name them.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "hezekiah" } }],
        responses: { "200": { description: "The person in full, with citations." }, "404": errorResponse },
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
      Range: {
        type: "object",
        required: ["start", "end"],
        properties: { start: { $ref: "#/components/schemas/VerseId" }, end: { $ref: "#/components/schemas/VerseId" } },
      },
      PassageResponse: {
        type: "object",
        required: ["reference", "range", "translation", "verses", "omissions"],
        properties: {
          reference: { type: "string" },
          range: { $ref: "#/components/schemas/Range" },
          translation: { type: "object", properties: { code: { type: "string" }, name: { type: "string" }, copyright: { type: "string" } } },
          verses: { type: "array", items: { $ref: "#/components/schemas/Verse" } },
          omissions: { type: "array", items: { type: "object", properties: { verseId: { $ref: "#/components/schemas/VerseId" }, verse: { type: "string" }, reason: { type: "string" }, history: { type: "string", description: "Reader-facing transmission history; does not claim an exact insertion date." }, printedBy: { type: "array", items: { type: "object" } } } } },
        },
      },
      Verse: {
        type: "object",
        required: ["verseId", "verse", "text"],
        properties: { verseId: { $ref: "#/components/schemas/VerseId" }, verse: { type: "string" }, text: { type: "string" } },
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
      VerseId: {
        type: "integer",
        description: "Canonical BBCCCVVV address. This is the only cross-surface verse address.",
        example: 43003016,
      },
    },
  },
} as const;

export async function GET() {
  return NextResponse.json(openapi, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
