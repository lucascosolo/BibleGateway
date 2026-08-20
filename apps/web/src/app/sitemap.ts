import type { MetadataRoute } from "next";

const BASE = "https://bible.lucascosolo.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/api", "/api/openapi.json", "/api/corpus", "/llms.txt", "/llms-full.txt", "/read/Gen.1", "/read/John.3", "/derash", "/lashon", "/parallel/John.3", "/notes"]
    .map((path) => ({ url: `${BASE}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.7 }));
}
