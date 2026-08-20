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
