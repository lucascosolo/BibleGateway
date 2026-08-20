import { CHAPTER_FACTOR, MAX_CHAPTER, MAX_VERSE, BOOK_FACTOR } from "@/lib/refs/verse-id";

/**
 * Validation for annotation writes.
 *
 * `POST /api/annotations` used to accept anything `Number.isFinite` would take. That meant
 * `43003016.5`, `-1`, `1001032` (encodable, but Genesis 1 has 31 verses), a reversed pair of
 * endpoints, an offset past the end of the verse text, and a translation id that names no
 * translation all reached the database. The failure modes split badly: some persisted an
 * annotation nothing would ever render — invisible, undeletable through the UI, and still
 * counted — and the rest surfaced as a 500 from a SQLite CHECK constraint, which tells the
 * caller nothing about what was wrong.
 *
 * The sparseness of the id space is the reason this cannot be done with arithmetic alone. An
 * id that *encodes* correctly is not a verse; only the corpus knows which ids are real. So
 * validation is deliberately in two phases:
 *
 *   1. `parseAnnotationInput` — shape and arithmetic. Pure, no corpus, no I/O.
 *   2. `checkAnnotationAnchor` — existence and bounds, against a lookup the caller builds
 *      from the corpus for exactly the two verse ids phase 1 extracted.
 *
 * Splitting them is what lets phase 1 tell the caller which ids to look up, and lets both be
 * tested without a database.
 */

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

export type AnnotationKind = "highlight" | "note" | "bookmark";

export interface AnnotationInput {
  kind: AnnotationKind;
  startVerseId: number;
  endVerseId: number;
  startOffset: number | null;
  endOffset: number | null;
  translationId: number | null;
  quotedText: string | null;
  color: string | null;
  body: string | null;
  tags: string[];
}

/** What phase 2 needs to know, and nothing else — so a test can supply it in three lines. */
export interface AnchorLookup {
  /** Verse ids that are real verses. */
  existingVerseIds: ReadonlySet<number>;
  /** Character length of a verse's text in the anchoring translation, or undefined if unprinted. */
  textLength: (verseId: number) => number | undefined;
  /** Translation ids the corpus actually has. */
  translationIds: ReadonlySet<number>;
}

const KINDS = new Set<AnnotationKind>(["highlight", "note", "bookmark"]);

/** Generous but finite. A note is prose, not a document store. */
const MAX_BODY = 20_000;
const MAX_QUOTED = 4_000;
const MAX_TAGS = 32;
const MAX_TAG_LENGTH = 64;

/**
 * A colour is a design token name, resolved to a CSS custom property at render time — never a
 * raw colour value (AGENTS.md: no raw hex in components). Matching the token *shape* rather
 * than a hardcoded palette keeps this from having to be edited every time a swatch is added,
 * while still refusing anything that could not be a token.
 */
const COLOR_TOKEN = /^[a-z][a-z0-9-]{0,23}$/;

const fail = (error: string): Validation<never> => ({ ok: false, error });

/** True when the integer decodes to a chapter and verse the encoding can represent at all. */
function isEncodableVerseId(value: number): boolean {
  if (!Number.isInteger(value) || value < BOOK_FACTOR) return false;
  const chapter = Math.floor((value % BOOK_FACTOR) / CHAPTER_FACTOR);
  const verse = value % CHAPTER_FACTOR;
  return chapter >= 1 && chapter <= MAX_CHAPTER && verse >= 1 && verse <= MAX_VERSE;
}

function optionalInteger(value: unknown, field: string): Validation<number | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (!Number.isInteger(value)) return fail(`\`${field}\` must be an integer`);
  return { ok: true, value: value as number };
}

function optionalString(value: unknown, field: string, max: number): Validation<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return fail(`\`${field}\` must be a string`);
  if (value.length > max) return fail(`\`${field}\` must be at most ${max} characters`);
  return { ok: true, value };
}

/** Phase 1: shape and arithmetic. Knows nothing about which verses exist. */
export function parseAnnotationInput(raw: unknown): Validation<AnnotationInput> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return fail("body must be a JSON object");
  }
  const input = raw as Record<string, unknown>;

  if (typeof input.kind !== "string" || !KINDS.has(input.kind as AnnotationKind)) {
    return fail("`kind` must be one of: highlight, note, bookmark");
  }
  const kind = input.kind as AnnotationKind;

  for (const field of ["startVerseId", "endVerseId"] as const) {
    if (!Number.isInteger(input[field])) {
      return fail(`\`${field}\` must be an integer verse id (BBCCCVVV)`);
    }
    if (!isEncodableVerseId(input[field] as number)) {
      return fail(`\`${field}\` is not a valid verse id: ${String(input[field])}`);
    }
  }
  const startVerseId = input.startVerseId as number;
  const endVerseId = input.endVerseId as number;

  // Not silently swapped. A reversed pair means the caller's selection logic is wrong, and
  // repairing it here would hide that while storing an anchor the user did not make.
  if (endVerseId < startVerseId) {
    return fail("`endVerseId` must not be before `startVerseId`");
  }

  const startOffset = optionalInteger(input.startOffset, "startOffset");
  if (!startOffset.ok) return startOffset;
  const endOffset = optionalInteger(input.endOffset, "endOffset");
  if (!endOffset.ok) return endOffset;

  // Offsets are a pair or they are absent. One without the other has no meaning: the renderer
  // reads them together and treats a half-anchor as a whole-verse anchor, silently discarding
  // whichever one was supplied.
  if ((startOffset.value === null) !== (endOffset.value === null)) {
    return fail("`startOffset` and `endOffset` must be supplied together, or both omitted");
  }

  const hasOffsets = startOffset.value !== null && endOffset.value !== null;
  if (hasOffsets) {
    if (startOffset.value! < 0 || endOffset.value! < 0) {
      return fail("character offsets must not be negative");
    }
    // Only within one verse do the two offsets index the same string. Across verses they
    // index different ones and ordering between them is not defined.
    if (startVerseId === endVerseId && endOffset.value! <= startOffset.value!) {
      return fail("`endOffset` must be greater than `startOffset` within a single verse");
    }
  }

  const translationId = optionalInteger(input.translationId, "translationId");
  if (!translationId.ok) return translationId;
  // Offsets are only valid *within* a translation (ARCHITECTURE §3.3). Stored without one,
  // nothing can ever decide whether they still apply, so the renderer could never safely use
  // them and could never honestly degrade either.
  if (hasOffsets && translationId.value === null) {
    return fail("`translationId` is required when character offsets are supplied");
  }

  const quotedText = optionalString(input.quotedText, "quotedText", MAX_QUOTED);
  if (!quotedText.ok) return quotedText;
  const body = optionalString(input.body, "body", MAX_BODY);
  if (!body.ok) return body;

  const color = optionalString(input.color, "color", MAX_TAG_LENGTH);
  if (!color.ok) return color;
  if (color.value !== null && !COLOR_TOKEN.test(color.value)) {
    return fail("`color` must be a colour token name (lowercase letters, digits and hyphens)");
  }

  let tags: string[] = [];
  if (input.tags !== undefined && input.tags !== null) {
    if (!Array.isArray(input.tags)) return fail("`tags` must be an array of strings");
    if (input.tags.length > MAX_TAGS) return fail(`\`tags\` must have at most ${MAX_TAGS} entries`);
    for (const tag of input.tags) {
      if (typeof tag !== "string" || tag.length === 0 || tag.length > MAX_TAG_LENGTH) {
        return fail(`each tag must be a string of 1-${MAX_TAG_LENGTH} characters`);
      }
    }
    tags = input.tags as string[];
  }

  return {
    ok: true,
    value: {
      kind,
      startVerseId,
      endVerseId,
      startOffset: startOffset.value,
      endOffset: endOffset.value,
      translationId: translationId.value,
      quotedText: quotedText.value,
      color: color.value,
      body: body.value,
      tags,
    },
  };
}

export interface AnnotationPatch {
  color?: string | null;
  body?: string | null;
  tags?: string[];
}

/**
 * PATCH payloads — the payload fields only.
 *
 * The anchor is deliberately not editable. Moving an annotation's address after the fact
 * would strand it in verse atoms no longer in its span, and re-anchoring is a different
 * operation with different rules (§3.3). An absent key means "leave it alone"; an explicit
 * `null` means "clear it", which is how a note's body is emptied.
 */
export function parseAnnotationPatch(raw: unknown): Validation<AnnotationPatch> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return fail("body must be a JSON object");
  }
  const input = raw as Record<string, unknown>;
  const patch: AnnotationPatch = {};

  if ("color" in input) {
    const color = optionalString(input.color, "color", MAX_TAG_LENGTH);
    if (!color.ok) return color;
    if (color.value !== null && !COLOR_TOKEN.test(color.value)) {
      return fail("`color` must be a colour token name (lowercase letters, digits and hyphens)");
    }
    patch.color = color.value;
  }

  if ("body" in input) {
    const body = optionalString(input.body, "body", MAX_BODY);
    if (!body.ok) return body;
    patch.body = body.value;
  }

  if ("tags" in input) {
    if (!Array.isArray(input.tags)) return fail("`tags` must be an array of strings");
    if (input.tags.length > MAX_TAGS) return fail(`\`tags\` must have at most ${MAX_TAGS} entries`);
    for (const tag of input.tags) {
      if (typeof tag !== "string" || tag.length === 0 || tag.length > MAX_TAG_LENGTH) {
        return fail(`each tag must be a string of 1-${MAX_TAG_LENGTH} characters`);
      }
    }
    patch.tags = input.tags as string[];
  }

  if (Object.keys(patch).length === 0) {
    return fail("nothing to update: supply `color`, `body` or `tags`");
  }

  return { ok: true, value: patch };
}

/**
 * Phase 2: does this anchor point at something real?
 *
 * The verse-id space is sparse, so this is the only step that can tell `1001032` from
 * `1001031`. Both endpoints are checked, not just the start — an annotation whose end verse
 * does not exist renders as a range that stops nowhere.
 */
export function checkAnnotationAnchor(
  input: AnnotationInput,
  lookup: AnchorLookup
): Validation<AnnotationInput> {
  if (input.translationId !== null && !lookup.translationIds.has(input.translationId)) {
    return fail(`unknown translation id ${input.translationId}`);
  }

  for (const [field, verseId] of [
    ["startVerseId", input.startVerseId],
    ["endVerseId", input.endVerseId],
  ] as const) {
    if (!lookup.existingVerseIds.has(verseId)) {
      return fail(`\`${field}\` ${verseId} is not a verse in the canon`);
    }
  }

  if (input.startOffset !== null && input.endOffset !== null) {
    const startLength = lookup.textLength(input.startVerseId);
    const endLength = lookup.textLength(input.endVerseId);
    if (startLength === undefined || endLength === undefined) {
      // The verse is real but this translation does not print it — one of the twelve
      // omissions. There is no text to have taken an offset from.
      return fail("character offsets were given for a verse this translation does not print");
    }
    // `endOffset` is exclusive, so it may equal the length; `startOffset` must land inside.
    if (input.startOffset >= startLength) {
      return fail(
        `\`startOffset\` ${input.startOffset} is past the end of verse ${input.startVerseId} (${startLength} characters)`
      );
    }
    if (input.endOffset > endLength) {
      return fail(
        `\`endOffset\` ${input.endOffset} is past the end of verse ${input.endVerseId} (${endLength} characters)`
      );
    }
  }

  return { ok: true, value: input };
}
