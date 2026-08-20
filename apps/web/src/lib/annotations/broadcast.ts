"use client";

import type { Annotation } from "@/lib/store/annotations";
import type { VerseId } from "@/lib/refs/verse-id";

/**
 * Cross-tab sync for annotations.
 *
 * `BroadcastChannel` fires only in OTHER same-origin tabs/windows, never the one that posted —
 * exactly the semantics `AnnotationSync` needs to apply a remote change into its local atoms
 * without re-applying its own write. This is the browser-native stand-in for the Realtime
 * subscription ARCHITECTURE §4.4 step 8 describes; swapping in a server push later only means
 * changing what calls `postAnnotationChange`.
 */

export type AnnotationBroadcastMessage =
  | { type: "upsert"; annotation: Annotation; verseIds: VerseId[] }
  | { type: "remove"; annotationId: string; verseIds: VerseId[] };

const CHANNEL_NAME = "jot-annotations";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function postAnnotationChange(message: AnnotationBroadcastMessage): void {
  getChannel()?.postMessage(message);
}

/** Returns an unsubscribe function. Safe to call where `BroadcastChannel` does not exist. */
export function subscribeAnnotationChanges(
  handler: (message: AnnotationBroadcastMessage) => void
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (event: MessageEvent<AnnotationBroadcastMessage>) => handler(event.data);
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}
