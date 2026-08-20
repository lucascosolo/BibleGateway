"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { Annotation } from "@/lib/store/annotations";

interface NoteRecord {
  annotation: Annotation;
  reference: string;
  slug: string;
  translationCode: string;
}

export function NotesIndex({ records }: { records: NoteRecord[] }) {
  const exportText = useMemo(
    () =>
      records
        .map(({ annotation, reference, translationCode }) => {
          const quote = annotation.quotedText ? `\n> ${annotation.quotedText}` : "";
          const body = annotation.body ? `\n\n${annotation.body}` : "";
          return `## ${reference} · ${translationCode} · ${annotation.kind}${quote}${body}`;
        })
        .join("\n\n"),
    [records],
  );

  function download() {
    const blob = new Blob([`# Jot notes\n\n${exportText}\n`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "jot-notes.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="notes-index" aria-labelledby="notes-title">
      <header className="notes-index__header">
        <div>
          <p className="notes-index__eyebrow">Personal research</p>
          <h1 id="notes-title">Notes &amp; highlights</h1>
          <p>Everything you marked, gathered in one place and anchored to its verse address.</p>
        </div>
        <button type="button" className="notes-index__export" onClick={download} disabled={!records.length}>
          Export Markdown
        </button>
      </header>

      {records.length === 0 ? (
        <div className="notes-index__empty">
          <h2>Your research notebook is empty</h2>
          <p>Select a phrase or open a verse mark while reading to save a highlight or note.</p>
          <Link href="/read/John.3">Open John 3</Link>
        </div>
      ) : (
        <ol className="notes-index__list">
          {records.map(({ annotation, reference, slug, translationCode }) => (
            <li key={annotation.annotationId} className="notes-index__item">
              <div className="notes-index__meta">
                <span>{annotation.kind}</span>
                <span>{translationCode}</span>
              </div>
              <Link href={`/read/${slug}?t=${translationCode}`} className="notes-index__reference">
                {reference}
              </Link>
              {annotation.quotedText && <blockquote>{annotation.quotedText}</blockquote>}
              {annotation.body && <p>{annotation.body}</p>}
              {annotation.tags.length > 0 && <p className="notes-index__tags">{annotation.tags.map((tag) => `#${tag}`).join(" ")}</p>}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
