// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ db: null as import("better-sqlite3").Database | null }));
vi.mock("server-only", () => ({}));
vi.mock("better-sqlite3", () => ({ default: function () { return fixture.db; } }));
vi.mock("node:fs", () => ({ default: { existsSync: () => true }, existsSync: () => true }));
vi.mock("fs", () => ({ default: { existsSync: () => true }, existsSync: () => true }));

beforeAll(async () => {
  const { default: Database } = await vi.importActual<typeof import("better-sqlite3")>("better-sqlite3");
  const fs = await vi.importActual<typeof import("node:fs")>("node:fs");
  const path = await vi.importActual<typeof import("node:path")>("node:path");
  const schema = fs.readFileSync(
    path.resolve(__dirname, "../../../../../packages/timeline/schema.sql"), "utf8");
  const db = new Database(":memory:");
  db.exec(schema);
  db.exec(`
    INSERT INTO meta VALUES ('build_id','abcd1234abcd1234'),('schema_version','1'),('corpus_build_id','c');
    INSERT INTO sources(source_id,kind,title) VALUES ('src-a','book','Book A'),('src-b','article','Article B');
    INSERT INTO eras VALUES ('era-1','Monarchy',-1000,-587,'s'),('era-2','Exile',-586,-539,'s'),('era-3','Hellenistic',-330,-63,'s');

    INSERT INTO events VALUES ('ev-exodus','Exodus','narrative','biblical-narrative','contested','draft','sum',NULL,NULL,-1446,-1200);
    INSERT INTO events VALUES ('ev-fall','Fall of Jerusalem','narrative','political','firm','reviewed','sum',NULL,NULL,-587,-586);
    INSERT INTO events VALUES ('ev-dan','Daniel written','composition','composition','contested','draft','sum',27,NULL,-600,-164);

    INSERT INTO positions VALUES ('ev-exodus/late','ev-exodus',2,'Late','Critical',-1290,-1200,'late sum','Scholars B');
    INSERT INTO positions VALUES ('ev-exodus/early','ev-exodus',1,'Early','Conservative',-1446,-1406,'early sum',NULL);
    INSERT INTO arguments VALUES (1,'ev-exodus/early',1,'for','Because 1 Kings 6:1');
    INSERT INTO arguments VALUES (2,'ev-exodus/early',2,'against','But Raamses');
    INSERT INTO citations(subject_kind,subject_id,source_id,locator,ordinal) VALUES
      ('argument','1','src-a','p. 5',1),('argument','2','src-b',NULL,1),
      ('position','ev-exodus/early','src-a','p. 9',1);

    INSERT INTO artifacts VALUES ('art-stele','Merneptah Stele','inscription',-1208,-1208,'Egyptian','sum',1896,'Thebes','Cairo Museum','CG 34025');
    INSERT INTO artifacts VALUES ('art-far','Far Thing','seal',-100,-90,'Greek','sum',NULL,NULL,NULL,NULL);
    INSERT INTO attestations VALUES (1,'art-stele','ev-exodus','consistent','Names Israel.');
    INSERT INTO citations(subject_kind,subject_id,source_id,locator,ordinal) VALUES ('attestation','1','src-b','p. 1',1);

    INSERT INTO issues VALUES ('iss-480','chronology','The 480 years','sum','draft');
    INSERT INTO issue_views VALUES (1,'iss-480',1,'Literal','text');
    INSERT INTO issue_events VALUES ('iss-480','ev-exodus');
    INSERT INTO issues VALUES ('iss-other','textual','Other','sum','draft');
    INSERT INTO issue_views VALUES (2,'iss-other',1,'V','text');

    INSERT INTO verse_links(subject_kind,subject_id,start_verse_id,end_verse_id,link_type,note) VALUES
      ('event','ev-exodus',2012040,2012041,'describes',NULL),
      ('event','ev-exodus',11006001,11006001,'dates','480 years'),
      ('event','ev-fall',12025008,12025010,'describes',NULL),
      ('issue','iss-480',11006001,11006001,'dates',NULL),
      ('issue','iss-other',1001001,1001003,'background',NULL),
      ('artifact','art-stele',2012040,2012040,'background',NULL),
      ('artifact','art-far',27001001,27001001,'background',NULL);
  `);
  fixture.db = db;
});

afterAll(() => fixture.db?.close());

describe("getTimelineBuildId", () => {
  it("reads meta.build_id", async () => {
    const { getTimelineBuildId } = await import("./timeline");
    expect(getTimelineBuildId()).toBe("abcd1234abcd1234");
  });
});

describe("getTimelineWindow", () => {
  it("returns only overlapping events on the requested axis, inclusive at the edges", async () => {
    const { getTimelineWindow } = await import("./timeline");
    const w = getTimelineWindow({ from: -586, to: -500, axis: "narrative" });
    expect(w.available).toBe(true);
    expect(w.events.map((e) => e.id)).toEqual(["ev-fall"]); // ev-fall ends at -586 exactly
    expect(w.events[0]).toMatchObject({ id: "ev-fall", axis: "narrative", earliest: -587, latest: -586 });
  });

  it("keeps the axes apart", async () => {
    const { getTimelineWindow } = await import("./timeline");
    const comp = getTimelineWindow({ from: -700, to: -100, axis: "composition" });
    expect(comp.events.map((e) => e.id)).toEqual(["ev-dan"]);
    const narr = getTimelineWindow({ from: -700, to: -100, axis: "narrative" });
    expect(narr.events.map((e) => e.id)).toEqual(["ev-fall"]);
  });

  it("returns both axes when axis is omitted, and excludes non-overlapping events", async () => {
    const { getTimelineWindow } = await import("./timeline");
    const all = getTimelineWindow({ from: -1300, to: -1250 });
    expect(all.events.map((e) => e.id)).toEqual(["ev-exodus"]);
    const both = getTimelineWindow({ from: -600, to: -586 });
    expect(both.events.map((e) => e.id).sort()).toEqual(["ev-dan", "ev-fall"]);
    expect(getTimelineWindow({ from: 100, to: 200 }).events).toEqual([]);
  });

  it("returns overlapping eras", async () => {
    const { getTimelineWindow } = await import("./timeline");
    const w = getTimelineWindow({ from: -600, to: -586 });
    expect(w.eras.map((e) => e.id).sort()).toEqual(["era-1", "era-2"]);
    expect(w.eras[0]).toHaveProperty("name");
  });
});

describe("getEvent", () => {
  it("returns positions by ordinal with arguments, citations, attestations, links, issues, status", async () => {
    const { getEvent } = await import("./timeline");
    const ev = getEvent("ev-exodus");
    expect(ev).not.toBeNull();
    expect(ev).toMatchObject({ id: "ev-exodus", title: "Exodus", status: "draft", confidence: "contested" });
    expect(ev!.positions.map((p) => p.id)).toEqual(["ev-exodus/early", "ev-exodus/late"]);
    const early = ev!.positions[0];
    expect(early).toMatchObject({ label: "Early", earliest: -1446, latest: -1406 });
    expect(early.arguments.map((a) => a.stance)).toEqual(["for", "against"]);
    expect(early.arguments[0].text).toBe("Because 1 Kings 6:1");
    expect(early.arguments[0].citations[0]).toMatchObject({ title: "Book A", locator: "p. 5" });
    expect(early.arguments[1].citations[0]).toMatchObject({ title: "Article B" });
    expect(ev!.attestations).toHaveLength(1);
    expect(ev!.attestations[0]).toMatchObject({ relation: "consistent", note: "Names Israel." });
    expect(JSON.stringify(ev!.attestations[0])).toContain("Merneptah Stele");
    expect(ev!.verses).toHaveLength(2);
    expect(ev!.issueIds).toEqual(["iss-480"]);
  });

  it("returns null for an unknown id", async () => {
    const { getEvent, getArtifact, getIssue } = await import("./timeline");
    expect(getEvent("nope")).toBeNull();
    expect(getArtifact("nope")).toBeNull();
    expect(getIssue("nope")).toBeNull();
  });
});

describe("getArtifact and getIssue", () => {
  it("returns an artifact with its fields", async () => {
    const { getArtifact } = await import("./timeline");
    const a = getArtifact("art-stele");
    expect(a).toMatchObject({ id: "art-stele", name: "Merneptah Stele" });
  });
  it("returns an issue with its views and linked events", async () => {
    const { getIssue } = await import("./timeline");
    const i = getIssue("iss-480");
    expect(i).toMatchObject({ id: "iss-480", title: "The 480 years", status: "draft" });
    expect(i!.views).toHaveLength(1);
    expect(i!.views[0]).toMatchObject({ label: "Literal" });
    expect(JSON.stringify(i!.eventIds ?? i!.events)).toContain("ev-exodus");
  });
});

describe("getTimelineForRange", () => {
  it("returns subjects whose verse links intersect the range", async () => {
    const { getTimelineForRange } = await import("./timeline");
    const r = getTimelineForRange({ start: 11_006_001 as never, end: 11_006_005 as never });
    expect(r.events.map((e) => e.id)).toEqual(["ev-exodus"]);
    expect(r.issues.map((i) => i.id)).toEqual(["iss-480"]);
    expect(r.artifacts).toEqual([]);
  });

  it("counts a link ending exactly at range.start", async () => {
    const { getTimelineForRange } = await import("./timeline");
    const r = getTimelineForRange({ start: 2_012_041 as never, end: 2_012_045 as never });
    expect(r.events.map((e) => e.id)).toEqual(["ev-exodus"]);
    expect(r.artifacts.map((a) => a.id)).toEqual([]); // stele link is 2012040 only
    const r2 = getTimelineForRange({ start: 2_012_040 as never, end: 2_012_040 as never });
    expect(r2.artifacts.map((a) => a.id)).toEqual(["art-stele"]);
  });

  it("returns empty lists when nothing intersects", async () => {
    const { getTimelineForRange } = await import("./timeline");
    const r = getTimelineForRange({ start: 66_001_001 as never, end: 66_001_010 as never });
    expect(r).toMatchObject({ events: [], issues: [], artifacts: [] });
  });
});
