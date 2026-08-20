import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";


export const RAW_DIR = path.resolve(import.meta.dirname, "..", "..", "..", "data", "raw");

interface Source {
  url: string;
  filename: string;
}

/** Downloads a file into data/raw/ unless it's already cached there. Returns the local path. */
export async function fetchCached({ url, filename }: Source): Promise<string> {
  await mkdir(RAW_DIR, { recursive: true });
  const dest = path.join(RAW_DIR, filename);

  if (existsSync(dest)) {
    console.log(`[download] cached: ${filename}`);
    return dest;
  }

  console.log(`[download] fetching ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`[download] saved ${filename} (${buf.byteLength} bytes)`);
  return dest;
}

export async function sha256File(filePath: string): Promise<string> {
  const buf = await readFile(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Downloads a `.tar.gz` and extracts it into `data/raw/extracted/<name>/`, returning the
 * directory that was created inside it.
 *
 * Shells out to `tar` rather than adding a Node tar library. This is an offline build pipeline
 * that runs on one Linux host and never in production, `tar` is part of the base system there,
 * and a dependency that unpacks untrusted archives is a larger surface than a subprocess whose
 * arguments are fixed constants in this file. `--strip-components` is deliberately NOT used:
 * the archive's own top directory carries the upstream commit-ish name, which is the only
 * provenance the extracted tree has once the tarball is deleted.
 */
export async function fetchAndExtract({ url, filename }: Source, name: string): Promise<string> {
  const archive = await fetchCached({ url, filename });
  const root = path.join(RAW_DIR, "extracted", name);

  if (existsSync(root)) {
    console.log(`[download] already extracted: ${name}`);
  } else {
    await mkdir(root, { recursive: true });
    console.log(`[download] extracting ${filename} ...`);
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    await promisify(execFile)("tar", ["xzf", archive, "-C", root]);
  }

  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(root, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length !== 1) {
    throw new Error(
      `Expected exactly one top-level directory in ${filename}, found ${dirs.length}. ` +
        `The archive layout changed; check the parser before trusting the corpus.`
    );
  }
  return path.join(root, dirs[0].name);
}
