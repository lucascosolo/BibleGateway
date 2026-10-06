/** `bytes=a-b`, `bytes=a-`, `bytes=-n` → [start, end] inclusive, or null if unusable. */
export function parseRange(header: string | null, size: number): [number, number] | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, a, b] = m;
  if (a === "" && b === "") return null;
  let start: number;
  let end: number;
  if (a === "") {
    // Suffix range: the last n bytes.
    const n = Number(b);
    if (n === 0) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(a);
    end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
  }
  if (start > end || start >= size) return null;
  return [start, end];
}

