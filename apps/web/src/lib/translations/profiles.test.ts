import { describe, expect, it } from "vitest";

import { getLexiconEntry, type LexiconId } from "@/lib/lexicon";

import { FAMILIES, PROFILES, dependentPairs, getProfile, profileCitations } from "./profiles";

describe("translation profiles: coverage", () => {
  it("profiles the original-language texts", () => {
    expect(getProfile("WLC")?.kind).toBe("original");
    expect(getProfile("SBLGNT")?.kind).toBe("original");
  });

  it("looks codes up case-insensitively", () => {
    expect(getProfile("kjv")?.code).toBe("KJV");
  });
});

describe("translation profiles: citations", () => {
  it("every profile carries at least one well-formed citation", () => {
    for (const p of PROFILES) {
      const cites = profileCitations(p);
      expect(cites.length, p.code).toBeGreaterThanOrEqual(1);
      for (const c of cites) {
        expect(c.source.trim(), p.code).not.toBe("");
        expect(c.locator.trim(), p.code).not.toBe("");
      }
    }
  });

  it("publisher-only citations link to an https page", () => {
    for (const p of PROFILES) {
      for (const c of profileCitations(p).filter((x) => x.publisherOnly)) {
        expect(c.url?.startsWith("https://"), `${p.code}: ${c.source}`).toBe(true);
      }
    }
  });
});

describe("translation profiles: dependence", () => {
  it("notIndependentOf is symmetric and never self-referential", () => {
    for (const p of PROFILES) {
      for (const c of p.notIndependentOf) {
        expect(c, p.code).not.toBe(p.code);
        const other = getProfile(c);
        expect(other, `${p.code} -> ${c}`).toBeDefined();
        expect(other!.notIndependentOf, `${c} -> ${p.code}`).toContain(p.code);
      }
    }
  });

  it("dependentPairs finds KJV/ASV once and ignores independent DBY", () => {
    const pairs = dependentPairs(["KJV", "ASV", "DBY"]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toContain("KJV");
    expect(pairs[0]).toContain("ASV");
  });

  it("dependentPairs treats DBY and YLT as independent works", () => {
    expect(dependentPairs(["DBY", "YLT"])).toEqual([]);
  });

  it("dependentPairs ignores unknown codes", () => {
    expect(dependentPairs(["KJV", "NOPE"])).toEqual([]);
  });
});

describe("translation profiles: fields", () => {
  it("family is a known family and approach has a lexicon gloss", () => {
    for (const p of PROFILES) {
      expect(Object.keys(FAMILIES), p.code).toContain(p.family);
      const entry = getLexiconEntry(`approach-${p.approach}` as LexiconId);
      expect(entry.gloss.trim(), p.code).not.toBe("");
    }
  });

  it("readWhen, year and status are filled in", () => {
    for (const p of PROFILES) {
      expect(p.readWhen.trim(), p.code).not.toBe("");
      expect(p.year.trim(), p.code).not.toBe("");
      expect(["sources-located", "claims-checked"], p.code).toContain(p.status);
    }
  });
});

describe("approach lexicon entries", () => {
  it.each(["formal", "functional", "balanced", "original"])("approach-%s has term, gloss and matching plain label", (a) => {
    const e = getLexiconEntry(`approach-${a}` as LexiconId);
    expect(e.term.trim()).not.toBe("");
    expect(e.gloss.trim()).not.toBe("");
    expect(e.term).toBe(e.plainLabel);
  });
});
