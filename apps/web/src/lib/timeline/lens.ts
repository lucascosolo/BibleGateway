/**
 * Critical and archaeological scholarship leads; traditional chronology (a count of the Bible's
 * own numbers) is a separate lens, shown last and apart. Pure, so every surface agrees.
 */
export const TRADITION_ORDER = ["archaeological", "critical", "chronological", "traditional"] as const;

export function isTraditional(tradition: string): boolean {
  return tradition === "traditional";
}

const rank = (tradition: string) => {
  const i = (TRADITION_ORDER as readonly string[]).indexOf(tradition);
  return i === -1 ? TRADITION_ORDER.length : i;
};

/** Stable sort by `TRADITION_ORDER`; never mutates its input. */
export function orderPositions<T extends { tradition: string }>(positions: readonly T[]): T[] {
  return [...positions].sort((a, b) => rank(a.tradition) - rank(b.tradition));
}

export function splitPositions<T extends { tradition: string }>(positions: readonly T[]): { scholarly: T[]; traditional: T[] } {
  return {
    scholarly: orderPositions(positions.filter((p) => !isTraditional(p.tradition))),
    traditional: positions.filter((p) => isTraditional(p.tradition)),
  };
}
