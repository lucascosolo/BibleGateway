import type { MatchOffset } from "./query";

/** `/api/search` response shape — shared between the route and the client search page. */
export interface SearchApiHit {
  verseId: number;
  chapter: number;
  verse: number;
  text: string;
  heatBucket: number;
  bookId: number;
  bookName: string;
  matches: MatchOffset[];
  original?: {
    surface: string;
    lemma: string;
    morph: string;
    language: string;
    position: number;
    strongs: string | null;
  };
}

export interface SearchApiBookCount {
  bookId: number;
  bookName: string;
  count: number;
}

export interface SearchApiResponse {
  query: string;
  translation: { code: string };
  testament?: "OT" | "NT" | "DC";
  bookId?: number;
  total: number;
  returned: number;
  limit: number;
  offset: number;
  hits: SearchApiHit[];
  bookDistribution: SearchApiBookCount[];
}

export interface OriginalSearchApiHit extends SearchApiHit {
  original: NonNullable<SearchApiHit["original"]>;
}

export interface OriginalSearchApiResponse {
  query: string;
  mode: "original";
  language?: "hbo" | "arc" | "grc";
  morph?: string;
  total: number;
  returned: number;
  limit: number;
  offset: number;
  hits: OriginalSearchApiHit[];
  bookDistribution: SearchApiBookCount[];
}
