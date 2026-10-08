// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { VerseId } from "@/lib/refs/verse-id";

const fixture = vi.hoisted(() => ({ db: null as import("better-sqlite3").Database | null }));
vi.mock("server-only", () => ({}));
vi.mock("better-sqlite3", () => ({ default: function () { return fixture.db; } }));
vi.mock("node:fs", () => ({ default: { existsSync: () => true } }));
vi.mock("@/lib/db/client", () => ({ prepared: (sql: string) => fixture.db!.prepare(sql) }));

beforeAll(async () => {
  const { default: Database } = await vi.importActual<{ default: typeof import("better-sqlite3") }>("better-sqlite3");
  const db = new Database(":memory:");
  fixture.db = db;
  db.exec(`
    CREATE TABLE books(book_id INTEGER, osis_id TEXT, name TEXT);
    INSERT INTO books VALUES(65, 'Jude', 'Jude'), (66, 'Rev', 'Revelation');
    CREATE TABLE verses(verse_id INTEGER, book_id INTEGER, chapter INTEGER, verse INTEGER);
    INSERT INTO verses VALUES(65001025,65,1,25),(66001001,66,1,1);
    CREATE TABLE audio_meta(key TEXT, value TEXT);
    INSERT INTO audio_meta VALUES('build_id','test');
    CREATE TABLE audio_editions(edition_id INTEGER, code TEXT, translation_code TEXT, language TEXT,
      name TEXT, reader TEXT, license TEXT, attribution TEXT, source_url TEXT, pronunciation_note TEXT);
    INSERT INTO audio_editions VALUES(1,'WEB','WEB','eng','WEB','Reader','Public domain','Reader','https://example.com',NULL);
    CREATE TABLE audio_chapters(edition_id INTEGER, book_id INTEGER, chapter INTEGER, file TEXT, duration_ms INTEGER);
    INSERT INTO audio_chapters VALUES(1,65,1,'WEB/65-001.m4a',10000),(1,66,1,'WEB/66-001.m4a',10000);
    CREATE TABLE audio_verses(edition_id INTEGER, verse_id INTEGER, start_ms INTEGER, end_ms INTEGER);
    INSERT INTO audio_verses VALUES(1,65001025,1000,2000),(1,66001001,1000,2000);
  `);
});

afterAll(() => fixture.db?.close());

describe("getPassageAudio sparse chapter boundaries", () => {
  it("includes both real chapters across Jude to Revelation without inventing Jude chapters", async () => {
    const { getPassageAudio } = await import("./audio");
    const audio = getPassageAudio({ start: 65_001_025 as VerseId, end: 66_001_001 as VerseId });
    expect(audio?.chapters.map(({ bookId, chapter }) => [bookId, chapter])).toEqual([[65, 1], [66, 1]]);
    expect(audio?.chapters[1].byEdition.WEB.verses.map(({ verseId }) => verseId)).toEqual([66_001_001]);
  });
});
