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

    INSERT INTO events(event_id,title,axis,category,confidence,status,summary,segment_label,earliest_year,latest_year) VALUES ('ev-exodus','Exodus','narrative','biblical-narrative','contested','draft','sum',NULL,-1446,-1200);
    INSERT INTO events(event_id,title,axis,category,confidence,status,summary,segment_label,earliest_year,latest_year) VALUES ('ev-fall','Fall of Jerusalem','narrative','political','firm','claims-checked','sum',NULL,-587,-586);
    INSERT INTO events(event_id,title,axis,category,confidence,status,summary,segment_label,earliest_year,latest_year) VALUES ('ev-dan','Daniel written','composition','composition','contested','draft','sum',NULL,-600,-164);
    INSERT INTO event_books VALUES ('ev-dan',27),('ev-dan',26);
    INSERT INTO events(event_id,title,axis,category,confidence,status,summary,segment_label,earliest_year,latest_year) VALUES ('ev-canon','Torah closed','canon','canon','speculative','draft','sum',NULL,-450,-400);

    INSERT INTO positions VALUES ('ev-exodus/late','ev-exodus',2,'Late','Critical',-1290,-1200,'late sum','Scholars B','event');
    INSERT INTO positions VALUES ('ev-exodus/early','ev-exodus',1,'Early','Conservative',-1446,-1406,'early sum',NULL,'event');
    INSERT INTO arguments VALUES ('ev-exodus/early/argument-1','ev-exodus/early',1,'for','Because 1 Kings 6:1');
    INSERT INTO arguments VALUES ('ev-exodus/early/argument-2','ev-exodus/early',2,'against','But Raamses');
    INSERT INTO citations(subject_kind,subject_id,source_id,locator,ordinal) VALUES
      ('argument','ev-exodus/early/argument-1','src-a','p. 5',1),('argument','ev-exodus/early/argument-2','src-b',NULL,1),
      ('position','ev-exodus/early','src-a','p. 9',1);

    INSERT INTO artifacts VALUES ('art-stele','Merneptah Stele','inscription','draft',-1208,-1208,'Egyptian','sum',1896,'Thebes','Cairo Museum','CG 34025');
    INSERT INTO artifacts VALUES ('art-far','Far Thing','seal','claims-checked',-100,-90,'Greek','sum',NULL,NULL,NULL,NULL);
    INSERT INTO attestations VALUES ('ev-exodus@art-stele','art-stele','ev-exodus','consistent','Names Israel.');
    INSERT INTO citations(subject_kind,subject_id,source_id,locator,ordinal) VALUES ('attestation','ev-exodus@art-stele','src-b','p. 1',1);

    INSERT INTO persons VALUES ('per-d','Early One',NULL,'patriarch','sum','draft',-900,-850,'none',0);
    INSERT INTO persons VALUES ('per-b','Beta','["Bee","Betty"]','king of Judah','Beta sum','draft',-700,-650,'corroborates',1);
    INSERT INTO persons VALUES ('per-a','Alpha',NULL,'prophet','sum','claims-checked',-700,-650,'silent',0);
    INSERT INTO persons VALUES ('per-c','Gamma',NULL,'apostle','sum','draft',NULL,NULL,'none',0);
    INSERT INTO person_attestations VALUES ('per-b@art-stele','per-b','art-stele','corroborates','Named.');
    INSERT INTO person_events VALUES ('per-b','ev-exodus');
    INSERT INTO citations(subject_kind,subject_id,source_id,locator,ordinal) VALUES
      ('person','per-b','src-a','p. 3',1),('person_attestation','per-b@art-stele','src-b','p. 4',1);
    INSERT INTO person_attestations VALUES ('per-a@art-far','per-a','art-far','partially-corroborates','Disputed reading.');
    INSERT INTO issues VALUES ('iss-480','chronology','The 480 years','sum','draft');
    INSERT INTO issue_views VALUES ('iss-480/view-1','iss-480',1,'Literal','text');
    INSERT INTO issue_events VALUES ('iss-480','ev-exodus');
    INSERT INTO issue_persons VALUES ('iss-480','per-b');
    INSERT INTO issues VALUES ('iss-other','textual','Other','sum','draft');
    INSERT INTO issue_views VALUES ('iss-other/view-1','iss-other',1,'V','text');

    INSERT INTO verse_links(subject_kind,subject_id,start_verse_id,end_verse_id,link_type,note) VALUES
      ('event','ev-exodus',2012040,2012041,'describes',NULL),
      ('event','ev-exodus',11006001,11006001,'dates','480 years'),
      ('event','ev-fall',12025008,12025010,'describes',NULL),
      ('issue','iss-480',11006001,11006001,'dates',NULL),
      ('issue','iss-other',1001001,1001003,'background',NULL),
      ('artifact','art-stele',2012040,2012040,'background',NULL),
      ('artifact','art-far',27001001,27001001,'background',NULL),
      ('person','per-b',14001001,14001002,'describes',NULL),
      ('argument','ev-exodus/early/argument-1',9001001,9001002,'alludes',NULL),
      ('artifact','art-far',19001001,19001001,'background',NULL),
      ('person','per-a',19001001,19001001,'describes',NULL),
      ('person','per-a',20001001,20001003,'describes',NULL),
      ('person','per-a',20001001,20001001,'alludes',NULL);

    INSERT INTO works(work_id,title,also_known_as,canon,status,summary,contents,original_language,composed_earliest,composed_latest,traditional_earliest,traditional_latest) VALUES ('w-enoch','1 Enoch','["Ethiopic Enoch"]','pseudepigrapha','draft','A composite apocalypse.',NULL,'Aramaic',-300,-1,-3000,-2900);
    INSERT INTO works(work_id,title,also_known_as,canon,status,summary,contents,original_language,composed_earliest,composed_latest,traditional_earliest,traditional_latest) VALUES ('w-gospel','A Lost Gospel',NULL,'described','claims-checked','Known by report.','Reported sayings.','Greek',100,199,NULL,NULL);
    INSERT INTO works(work_id,title,also_known_as,canon,status,summary,contents,original_language,composed_earliest,composed_latest,traditional_earliest,traditional_latest) VALUES ('w-baruch','2 Baruch','[]','deuterocanon','draft','Syriac apocalypse.',NULL,'Hebrew',70,135,NULL,NULL);
    INSERT INTO work_books VALUES ('w-enoch',85,1),('w-baruch',85,1),('w-baruch',86,2);
    INSERT INTO work_positions VALUES ('w-enoch/critical-stages','w-enoch',1,'Third to first century BCE','critical',-300,-1,'In stages.','R. H. Charles');
    INSERT INTO work_positions VALUES ('w-enoch/trad','w-enoch',2,'Antediluvian','traditional',-3000,-2900,'By Enoch.',NULL);
    INSERT INTO work_provenance VALUES ('w-enoch/provenance-1','w-enoch',1,'Judea','Probable.');
    INSERT INTO work_witnesses VALUES ('w-enoch/witness-1','w-enoch',1,'4Q201','4QEn^a',-200,-150,'Aramaic','IAA','https://example.org/4q201','Fragments.');
    INSERT INTO work_holders VALUES ('w-enoch/holder-1','w-enoch',1,'Ethiopian Orthodox Tewahedo Church',NULL);
    INSERT INTO work_translations VALUES ('w-enoch',1,'charles-1enoch','LXX','Charles 1917');
    INSERT INTO work_excerpts VALUES ('w-gospel/excerpt-1','w-gospel',1,'A short quoted line','Cited by a father.');
    INSERT INTO work_events VALUES ('w-enoch','ev-fall',1,'Context for the exile.');
    INSERT INTO work_verses VALUES ('w-enoch',1001001,1001002,'alludes','Echoed.');
    INSERT INTO work_citations(work_id,subject_kind,subject_id,source_id,locator,ordinal) VALUES
      ('w-enoch','work','w-enoch','src-a','p. 1',1),
      ('w-enoch','position','w-enoch/critical-stages','src-b','p. 3',1),
      ('w-enoch','provenance','w-enoch/provenance-1','src-a','p. 4',1),
      ('w-enoch','witness','w-enoch/witness-1','src-b','p. 5',1),
      ('w-enoch','holder','w-enoch/holder-1','src-a','p. 6',1),
      ('w-enoch','event','w-enoch@ev-fall','src-b','p. 7',1),
      ('w-gospel','work','w-gospel','src-a','p. 1',1),
      ('w-gospel','excerpt','w-gospel/excerpt-1','src-b','p. 2',1);
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

  it("exposes bookIds on composition events", async () => {
    const { getTimelineWindow } = await import("./timeline");
    const w = getTimelineWindow({ from: -600, to: -586, axis: "composition" });
    expect([...(w.events[0] as unknown as { bookIds: number[] }).bookIds].sort()).toEqual([26, 27]);
    expect(w.events[0]).not.toHaveProperty("bookId");
  });

  it("returns canon events only for axis canon", async () => {
    const { getTimelineWindow } = await import("./timeline");
    expect(getTimelineWindow({ from: -500, to: -300, axis: "canon" }).events.map((e) => e.id)).toEqual(["ev-canon"]);
    expect(getTimelineWindow({ from: -500, to: -300, axis: "narrative" }).events).toEqual([]);
    expect(getTimelineWindow({ from: -500, to: -300, axis: "composition" }).events.map((e) => e.id)).toEqual(["ev-dan"]);
  });

  it("returns overlapping eras", async () => {
    const { getTimelineWindow } = await import("./timeline");
    const w = getTimelineWindow({ from: -600, to: -586 });
    expect(w.eras.map((e) => e.id).sort()).toEqual(["era-1", "era-2"]);
    expect(w.eras[0]).toHaveProperty("name");
  });
});

describe("traditional lens columns", () => {
  // The client layer sets `query_only` on the shared mocked handle; lift it for the fixture write.
  const setTraditional = () =>
    fixture.db!.pragma("query_only = false") &&
    fixture.db!.prepare("UPDATE events SET traditional_earliest = -1900, traditional_latest = -1850 WHERE event_id = 'ev-fall'").run();
  const clear = () =>
    fixture.db!.pragma("query_only = false") &&
    fixture.db!.prepare("UPDATE events SET traditional_earliest = NULL, traditional_latest = NULL WHERE event_id = 'ev-fall'").run();

  it("getEvent returns traditional: null when the columns are NULL", async () => {
    const { getEvent } = await import("./timeline");
    expect(getEvent("ev-exodus")!.traditional).toBeNull();
  });

  it("getEvent and getEventSummaries return the populated envelope", async () => {
    const { getEvent, getEventSummaries } = await import("./timeline");
    setTraditional();
    try {
      expect(getEvent("ev-fall")!.traditional).toEqual({ earliest: -1900, latest: -1850 });
      const rows = getEventSummaries(["ev-fall", "ev-exodus"]);
      expect(rows.find((e) => e.id === "ev-fall")!.traditional).toEqual({ earliest: -1900, latest: -1850 });
      expect(rows.find((e) => e.id === "ev-exodus")!.traditional).toBeNull();
    } finally {
      clear();
    }
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
    expect(early.arguments[0].id).toBe("ev-exodus/early/argument-1");
    expect(early.arguments[0].text).toBe("Because 1 Kings 6:1");
    expect(early.arguments[0].citations[0]).toMatchObject({ title: "Book A", locator: "p. 5" });
    expect(early.arguments[1].citations[0]).toMatchObject({ title: "Article B" });
    expect(ev!.attestations).toHaveLength(1);
    expect(ev!.attestations[0].id).toBe("ev-exodus@art-stele");
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
    expect(a).toMatchObject({ id: "art-stele", name: "Merneptah Stele", status: "draft" });
    expect(a!.persons).toHaveLength(1);
    expect(a!.persons[0]).toMatchObject({
      id: "per-b@art-stele", personId: "per-b", personName: "Beta", relation: "corroborates", note: "Named.",
    });
    expect(a!.persons[0].citations[0]).toMatchObject({ title: "Article B", locator: "p. 4" });
  });
  it("returns an issue with its views and linked events", async () => {
    const { getIssue } = await import("./timeline");
    const i = getIssue("iss-480");
    expect(i).toMatchObject({ id: "iss-480", title: "The 480 years", status: "draft" });
    expect(i!.views).toHaveLength(1);
    expect(i!.views[0]).toMatchObject({ id: "iss-480/view-1", label: "Literal" });
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

  it("finds an event through an argument's verse link", async () => {
    const { getTimelineForRange } = await import("./timeline");
    const r = getTimelineForRange({ start: 9_001_001 as never, end: 9_001_001 as never });
    expect(r.events.map((e) => e.id)).toEqual(["ev-exodus"]);
  });

  it("returns empty lists when nothing intersects", async () => {
    const { getTimelineForRange } = await import("./timeline");
    const r = getTimelineForRange({ start: 66_001_001 as never, end: 66_001_010 as never });
    expect(r).toMatchObject({ events: [], issues: [], artifacts: [] });
  });
});

describe("persons", () => {
  it("getPersons lists everyone ordered by lived earliest then name", async () => {
    const { getPersons } = await import("./timeline");
    const all = getPersons();
    expect(all).toHaveLength(4);
    const dated = all.filter((p) => p.lived !== null).map((p) => p.id);
    expect(dated).toEqual(["per-d", "per-a", "per-b"]);
    const b = all.find((p) => p.id === "per-b");
    expect(b).toEqual({
      id: "per-b", name: "Beta", role: "king of Judah", evidence: "corroborates", hasTension: true,
      status: "draft", lived: { earliest: -700, latest: -650 },
      gist: "Beta sum", firstVerse: 14001001, firstYear: -700,
    });
    expect(all.find((p) => p.id === "per-c")).toMatchObject({ lived: null, hasTension: false, evidence: "none" });
  });

  it("getPerson returns the full record", async () => {
    const { getPerson } = await import("./timeline");
    const p = getPerson("per-b");
    expect(p).toMatchObject({
      id: "per-b", name: "Beta", alsoKnownAs: ["Bee", "Betty"], summary: "Beta sum",
      eventIds: ["ev-exodus"], issueIds: ["iss-480"],
    });
    expect(p!.citations[0]).toMatchObject({ title: "Book A", locator: "p. 3" });
    expect(p!.attestations).toHaveLength(1);
    expect(p!.attestations[0]).toMatchObject({
      id: "per-b@art-stele", artifactId: "art-stele", artifactName: "Merneptah Stele",
      artifactKind: "inscription", relation: "corroborates", note: "Named.",
    });
    expect(p!.attestations[0].citations[0]).toMatchObject({ title: "Article B", locator: "p. 4" });
    expect(p!.verses).toHaveLength(1);
    expect(getPerson("per-a")!.alsoKnownAs).toEqual([]);
    expect(getPerson("nope")).toBeNull();
  });

  it("getTimelineForRange returns persons by their verse links", async () => {
    const { getTimelineForRange } = await import("./timeline");
    const r = getTimelineForRange({ start: 14_001_002 as never, end: 14_001_005 as never });
    expect(r.persons.map((p) => p.id)).toEqual(["per-b"]);
    expect(getTimelineForRange({ start: 66_001_001 as never, end: 66_001_002 as never }).persons).toEqual([]);
  });
});

describe("id listings", () => {
  it("listEventIds returns every event id, earliest first", async () => {
    const { listEventIds } = await import("./timeline");
    expect(listEventIds()).toEqual(["ev-exodus", "ev-dan", "ev-fall", "ev-canon"]);
  });

  it("listArtifactIds returns every artifact id by date made", async () => {
    const { listArtifactIds } = await import("./timeline");
    expect(listArtifactIds()).toEqual(["art-stele", "art-far"]);
  });

  it("listIssueIds returns every issue id alphabetically", async () => {
    const { listIssueIds } = await import("./timeline");
    expect(listIssueIds()).toEqual(["iss-480", "iss-other"]);
  });
});

describe("getTimelineNotesForRange", () => {
  const range = (start: number, end: number) => ({ start: start as never, end: end as never });

  it("returns one note per intersecting link, each carrying its subject and link note", async () => {
    const { getTimelineNotesForRange } = await import("./timeline");
    const notes = getTimelineNotesForRange(range(11_006_001, 11_006_005));
    expect(notes.map((n) => n.id).sort()).toEqual(["event:ev-exodus@11006001", "issue:iss-480@11006001"]);
    const ev = notes.find((n) => n.id === "event:ev-exodus@11006001")!;
    expect(ev).toMatchObject({ anchor: 11_006_001, start: 11_006_001, end: 11_006_001, linkType: "dates", note: "480 years" });
    expect(ev.subject).toMatchObject({ kind: "event", id: "ev-exodus", title: "Exodus", status: "draft", confidence: "contested", earliest: -1446, latest: -1200 });
    expect((ev.subject as { positions: { label: string }[] }).positions.map((p) => p.label)).toEqual(["Early", "Late"]);
    const iss = notes.find((n) => n.id === "issue:iss-480@11006001")!;
    expect(iss.note).toBeNull();
    expect(iss.subject).toMatchObject({ kind: "issue", id: "iss-480", title: "The 480 years", issueKind: "chronology", status: "draft" });
  });

  it("describes an argument link by its event, position and stance", async () => {
    const { getTimelineNotesForRange } = await import("./timeline");
    const [n] = getTimelineNotesForRange(range(9_001_001, 9_001_001));
    expect(n.subject).toMatchObject({
      kind: "argument", eventId: "ev-exodus", eventTitle: "Exodus", eventStatus: "draft", positionLabel: "Early", stance: "for",
    });
  });

  it("describes a person by evidence grade and tension", async () => {
    const { getTimelineNotesForRange } = await import("./timeline");
    const [n] = getTimelineNotesForRange(range(14_001_001, 14_001_002));
    expect(n.subject).toMatchObject({ kind: "person", id: "per-b", name: "Beta", evidence: "corroborates", hasTension: true, status: "draft" });
  });

  it("clamps the anchor to range.start when the link begins earlier, keeping the full link", async () => {
    const { getTimelineNotesForRange } = await import("./timeline");
    const [n] = getTimelineNotesForRange(range(12_025_009, 12_025_012));
    expect(n).toMatchObject({ id: "event:ev-fall@12025009", anchor: 12_025_009, start: 12_025_008, end: 12_025_010 });
  });

  it("excludes links that do not intersect, and counts a link ending exactly at range.start", async () => {
    const { getTimelineNotesForRange } = await import("./timeline");
    expect(getTimelineNotesForRange(range(12_025_011, 12_025_020))).toEqual([]);
    expect(getTimelineNotesForRange(range(66_001_001, 66_001_010))).toEqual([]);
    expect(getTimelineNotesForRange(range(2_012_041, 2_012_045)).map((n) => n.subject.kind)).toEqual(["event"]);
  });

  it("dedupes a subject linked twice to the same anchor verse", async () => {
    const { getTimelineNotesForRange } = await import("./timeline");
    const notes = getTimelineNotesForRange(range(20_001_001, 20_001_005));
    expect(notes.map((n) => n.id)).toEqual(["person:per-a@20001001"]);
  });

  it("sets an artifact's relation from a person linked to the same verse", async () => {
    const { getTimelineNotesForRange } = await import("./timeline");
    const notes = getTimelineNotesForRange(range(19_001_001, 19_001_001));
    const art = notes.find((n) => n.subject.kind === "artifact")!;
    expect(art.subject).toMatchObject({ kind: "artifact", id: "art-far", name: "Far Thing", relation: "partially-corroborates" });
    expect(notes.some((n) => n.subject.kind === "person")).toBe(true);
  });

  it("uses an event linked to the same verse for the relation, and null when nothing else is linked", async () => {
    const { getTimelineNotesForRange } = await import("./timeline");
    const stele = getTimelineNotesForRange(range(2_012_040, 2_012_040)).find((n) => n.subject.kind === "artifact")!;
    expect(stele.subject).toMatchObject({ relation: "consistent" });
    const [far] = getTimelineNotesForRange(range(27_001_001, 27_001_001));
    expect(far.subject).toMatchObject({ kind: "artifact", id: "art-far", relation: null });
  });
});

describe("works", () => {
  it("getWorkSummaries is with book ids and both envelopes", async () => {
    const { getWorkSummaries } = await import("./timeline");
    const all = getWorkSummaries();
    expect(all.map((w) => w.id).sort()).toEqual(["w-baruch", "w-enoch", "w-gospel"]);
    expect(all.find((w) => w.id === "w-enoch")).toMatchObject({
      title: "1 Enoch", canon: "pseudepigrapha", status: "draft", bookIds: [85],
      composedEarliest: -300, composedLatest: -1, traditionalEarliest: -3000, traditionalLatest: -2900,
    });
    expect(all.find((w) => w.id === "w-gospel")).toMatchObject({
      canon: "described", bookIds: [], traditionalEarliest: null, traditionalLatest: null,
    });
    expect(all.find((w) => w.id === "w-baruch")!.bookIds).toEqual([85, 86]);
  });

  it("getWork returns the full detail with citations per part", async () => {
    const { getWork } = await import("./timeline");
    const w = getWork("w-enoch")!;
    expect(w).toMatchObject({
      id: "w-enoch", alsoKnownAs: ["Ethiopic Enoch"], summary: "A composite apocalypse.", contents: null,
      originalLanguage: "Aramaic", bookIds: [85],
    });
    expect(w.citations.map((c) => [c.sourceId, c.locator])).toEqual([["src-a", "p. 1"]]);
    // id is the position slug or the stored "<work>/<slug>"; the contract leaves it open.
    expect(w.composed.map((p) => p.id.split("/").pop())).toEqual(["critical-stages", "trad"]);
    expect(w.composed[0]).toMatchObject({
      label: "Third to first century BCE", tradition: "critical", earliest: -300, latest: -1,
      summary: "In stages.", heldBy: "R. H. Charles",
    });
    expect(w.composed[1].heldBy).toBeNull();
    expect(w.composed[0].citations.map((c) => c.sourceId)).toEqual(["src-b"]);
    expect(w.composed[1].citations).toEqual([]);
    expect(w.provenance[0]).toMatchObject({ place: "Judea", note: "Probable." });
    expect(w.provenance[0].citations[0]).toMatchObject({ sourceId: "src-a", locator: "p. 4" });
    expect(w.witnesses[0]).toMatchObject({
      siglum: "4Q201", name: "4QEn^a", earliest: -200, latest: -150, language: "Aramaic",
      institution: "IAA", url: "https://example.org/4q201", note: "Fragments.",
    });
    expect(w.witnesses[0].citations[0].sourceId).toBe("src-b");
    expect(w.heldCanonicalBy[0]).toMatchObject({ tradition: "Ethiopian Orthodox Tewahedo Church", note: null });
    expect(w.heldCanonicalBy[0].citations[0].sourceId).toBe("src-a");
    expect(w.translations).toEqual([{ ledger: "charles-1enoch", code: "LXX", note: "Charles 1917" }]);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({ id: "ev-fall", title: "Fall of Jerusalem", note: "Context for the exile." });
    expect(w.events[0].citations[0].sourceId).toBe("src-b");
    expect(w.verses).toEqual([{ start: 1_001_001, end: 1_001_002, linkType: "alludes", note: "Echoed." }]);
    expect(w.excerpts).toEqual([]);
  });

  it("getWork returns contents and excerpts for a described work", async () => {
    const { getWork } = await import("./timeline");
    const w = getWork("w-gospel")!;
    expect(w).toMatchObject({ canon: "described", contents: "Reported sayings.", alsoKnownAs: [], bookIds: [] });
    expect(w.excerpts).toHaveLength(1);
    expect(w.excerpts[0]).toMatchObject({ text: "A short quoted line", note: "Cited by a father." });
    expect(w.excerpts[0].citations[0]).toMatchObject({ sourceId: "src-b", locator: "p. 2" });
  });

  it("getWork returns null for an unknown id", async () => {
    const { getWork } = await import("./timeline");
    expect(getWork("missing")).toBeNull();
  });

  it("getWorksForBook returns every work printed in that book, and nothing for other books", async () => {
    const { getWorksForBook } = await import("./timeline");
    expect(getWorksForBook(85).map((w) => w.id).sort()).toEqual(["w-baruch", "w-enoch"]);
    expect(getWorksForBook(86).map((w) => w.id)).toEqual(["w-baruch"]);
    expect(getWorksForBook(1)).toEqual([]);
  });
});

describe("works against a timeline.db built before works existed", () => {
  it("returns [] / null and never throws", async () => {
    const { default: Database } = await vi.importActual<typeof import("better-sqlite3")>("better-sqlite3");
    const fs = await vi.importActual<typeof import("node:fs")>("node:fs");
    const path = await vi.importActual<typeof import("node:path")>("node:path");
    const schema = fs.readFileSync(
      path.resolve(__dirname, "../../../../../packages/timeline/schema.sql"), "utf8");
    // Cut the works section (it starts at the CREATE TABLE works statement) to model an old schema.
    const cut = schema.search(/CREATE TABLE works\b/);
    const old = new Database(":memory:");
    old.exec(cut === -1 ? schema : schema.slice(0, cut));
    const prior = fixture.db;
    fixture.db = old;
    vi.resetModules();
    try {
      const t = await import("./timeline");
      expect(t.getWorkSummaries()).toEqual([]);
      expect(t.getWork("w-enoch")).toBeNull();
      expect(t.getWorksForBook(85)).toEqual([]);
    } finally {
      fixture.db = prior;
      old.close();
      vi.resetModules();
    }
  });
});

describe("works with no composition date (composed_undated)", () => {
  const REASON = "No scholar has proposed a date; the only witness is undated.";
  const WORK_COLS =
    "work_id,title,canon,status,summary,original_language,composed_undated,composed_earliest,composed_latest";

  async function withDb(setup: (db: import("better-sqlite3").Database) => void) {
    const { default: Database } = await vi.importActual<typeof import("better-sqlite3")>("better-sqlite3");
    const fs = await vi.importActual<typeof import("node:fs")>("node:fs");
    const path = await vi.importActual<typeof import("node:path")>("node:path");
    const schema = fs.readFileSync(
      path.resolve(__dirname, "../../../../../packages/timeline/schema.sql"), "utf8");
    const db = new Database(":memory:");
    db.exec(schema);
    setup(db);
    const prior = fixture.db;
    fixture.db = db;
    vi.resetModules();
    return {
      t: await import("./timeline"),
      done() { fixture.db = prior; db.close(); vi.resetModules(); },
    };
  }

  it("getWork and getWorkSummaries return the reason, null envelope and empty composed", async () => {
    const h = await withDb((db) => {
      db.exec(`
        INSERT INTO sources(source_id,kind,title) VALUES ('src-a','book','Book A');
        INSERT INTO works(${WORK_COLS}) VALUES ('w-undated','Undated','pseudepigrapha','draft','s','Greek','${REASON}',NULL,NULL);
        INSERT INTO works(${WORK_COLS}) VALUES ('w-dated','Dated','pseudepigrapha','draft','s','Greek',NULL,-300,-1);
      `);
    });
    try {
      const w = h.t.getWork("w-undated")!;
      expect(w).toMatchObject({ composedUndated: REASON, composedEarliest: null, composedLatest: null, composed: [] });
      const all = h.t.getWorkSummaries();
      expect(all.find((x) => x.id === "w-undated")).toMatchObject({
        composedUndated: REASON, composedEarliest: null, composedLatest: null,
        traditionalEarliest: null, traditionalLatest: null,
      });
      expect(all.find((x) => x.id === "w-dated")).toMatchObject({
        composedUndated: null, composedEarliest: -300, composedLatest: -1,
      });
    } finally {
      h.done();
    }
  });

  it("a works table without the composed_undated column yields composedUndated null and still works", async () => {
    const h = await withDb((db) => {
      // Model a timeline.db built before this change: same schema, old works table.
      db.exec(`
        DROP TABLE works;
        CREATE TABLE works (
          work_id TEXT PRIMARY KEY, title TEXT NOT NULL, also_known_as TEXT, canon TEXT NOT NULL,
          status TEXT NOT NULL, summary TEXT NOT NULL, contents TEXT, original_language TEXT NOT NULL,
          composed_earliest INTEGER NOT NULL, composed_latest INTEGER NOT NULL,
          traditional_earliest INTEGER, traditional_latest INTEGER
        );
        INSERT INTO works(work_id,title,canon,status,summary,original_language,composed_earliest,composed_latest)
          VALUES ('w-old','Old','pseudepigrapha','draft','s','Greek',-300,-1);
      `);
    });
    try {
      expect(h.t.getWork("w-old")).toMatchObject({ composedUndated: null, composedEarliest: -300, composedLatest: -1 });
      expect(h.t.getWorkSummaries()).toHaveLength(1);
      expect(h.t.getWorkSummaries()[0]).toMatchObject({ id: "w-old", composedUndated: null, composedEarliest: -300 });
    } finally {
      h.done();
    }
  });
});
