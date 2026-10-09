// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ db: null as import("better-sqlite3").Database | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ prepared: (sql: string) => fixture.db!.prepare(sql) }));

beforeAll(async () => {
  const { default: Database } = await vi.importActual<{ default: typeof import("better-sqlite3") }>("better-sqlite3");
  const db = new Database(":memory:");
  fixture.db = db;
  db.exec(`
    CREATE TABLE books(book_id INTEGER, canon TEXT);
    INSERT INTO books VALUES(1,'hebrew'),(40,'nt'),(67,'nt-apocrypha');
    CREATE TABLE verses(verse_id INTEGER, book_id INTEGER);
    INSERT INTO verses VALUES(1001001,1),(1001002,1),(40001001,40),(67001001,67),(67001002,67),(67001003,67);
  `);
});
afterAll(() => fixture.db?.close());

describe("home-page verse count", () => {
  it("is the canonical 66-book count even when outside books are stored", async () => {
    const { getVerseCount, getCanonicalVerseCount } = await import("./corpus");
    expect(getVerseCount()).toBe(3);
    expect(getVerseCount()).toBe(getCanonicalVerseCount());
  });
});
