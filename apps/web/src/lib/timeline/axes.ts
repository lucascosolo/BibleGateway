/**
 * The timeline's three axes — three different questions, never merged onto one scale
 * (ARCHITECTURE.md §0.2):
 *
 * - `narrative`: when the events described happened.
 * - `composition`: when the texts were written or edited.
 * - `canon`: when collections came to be recognised as scripture.
 *
 * Pure vocabulary, shared by the db layer and the API; it reads nothing.
 */
export const AXES = ["narrative", "composition", "canon"] as const;
export type Axis = (typeof AXES)[number];

export function isAxis(value: string): value is Axis {
  return (AXES as readonly string[]).includes(value);
}
