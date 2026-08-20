"use client";

import type { Annotation } from "@/lib/store/annotations";
import type { VerseRange } from "@/lib/refs/verse-id";

/**
 * Thin fetch wrappers around `/api/annotations`. Kept separate from `useAnnotations.ts` so
 * the network shape and the optimistic-write orchestration are independently readable and
 * testable.
 */

export interface CreateAnnotationBody {
  kind: Annotation["kind"];
  startVerseId: number;
  endVerseId: number;
  startOffset?: number | null;
  endOffset?: number | null;
  translationId?: number | null;
  quotedText?: string | null;
  color?: string | null;
  body?: string | null;
  tags?: string[];
}

export async function fetchAnnotationsInRange(range: VerseRange): Promise<Annotation[]> {
  const res = await fetch(`/api/annotations?start=${range.start}&end=${range.end}`, {
    // Per-user data. Never let the browser or an intermediary cache this.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`failed to load annotations (${res.status})`);
  const data = (await res.json()) as { annotations: Annotation[] };
  return data.annotations;
}

export async function postAnnotation(body: CreateAnnotationBody): Promise<Annotation> {
  const res = await fetch("/api/annotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`failed to create annotation (${res.status})`);
  const data = (await res.json()) as { annotation: Annotation };
  return data.annotation;
}

export async function patchAnnotation(
  id: string,
  patch: Partial<Pick<CreateAnnotationBody, "color" | "body" | "tags">>
): Promise<Annotation> {
  const res = await fetch(`/api/annotations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`failed to update annotation (${res.status})`);
  const data = (await res.json()) as { annotation: Annotation };
  return data.annotation;
}

export async function deleteAnnotationRequest(id: string): Promise<void> {
  const res = await fetch(`/api/annotations/${id}`, { method: "DELETE", cache: "no-store" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`failed to delete annotation (${res.status})`);
  }
}
