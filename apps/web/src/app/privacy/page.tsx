import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Jot stores, where it stores it, and why. No accounts, no analytics, no advertising.",
};

const SECTIONS: { heading: string; body: ReactNode[] }[] = [
  {
    heading: "On the server: your notes and highlights",
    body: [
      <>
        Jot has no accounts. The first time the reader asks for your notes, the server gives your browser
        a random identifier in a cookie named <code>jot_uid</code>. It lasts a year, is sent only to this
        site, and cannot be read by scripts on the page. It is the only cookie Jot sets.
      </>,
      <>
        Highlights, notes and bookmarks you make are stored on Jot&rsquo;s server under that identifier:
        the verses they point at, the words you selected, the colour, the note text and tags, and when
        each was made and last changed. Nothing ties the identifier to your name or email.
      </>,
      <>
        Deleting a note marks it deleted and hides it everywhere; the record stays in the database. There
        is no automatic expiry. Clearing your cookies loses the identifier, and with it the way back to
        those notes from that browser.
      </>,
    ],
  },
  {
    heading: "In your browser only",
    body: [
      <>
        Your settings are kept in your browser&rsquo;s local storage under <code>jot-preferences</code>:
        which layers are on, theme, plain labels, translation, tradition, the passage you last read, and
        whether you have seen the tour. The chosen audio recording and playback speed are kept under{" "}
        <code>jot-audio</code>. None of this is sent to the server.
      </>,
    ],
  },
  {
    heading: "No analytics, no third parties",
    body: [
      <>
        Jot runs no analytics, tracking or advertising scripts. The fonts, the text and the audio are all
        served from this site, so reading a page makes no requests to anyone else.
      </>,
      <>
        Links to sources and to other sites only take you there when you follow them. The donation button
        opens PayPal; Jot sends it nothing about you, and PayPal&rsquo;s own privacy policy covers what you
        give it there.
      </>,
    ],
  },
  {
    heading: "Server logs",
    body: [
      <>
        Jot runs on Next.js with its default logging, which writes startup messages and errors, not a
        record of each visit. The connection itself passes through the hosting network like any web
        request.
      </>,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-4">
        <Wordmark size="md" />
        <h1 className="font-serif text-[length:var(--text-xl)] text-[var(--color-ink)]">Privacy</h1>
      </header>

      {SECTIONS.map((s) => (
        <section key={s.heading} className="flex flex-col gap-3">
          <h2 className="font-sans text-[length:var(--text-md)] font-semibold text-[var(--color-ink)]">{s.heading}</h2>
          <div className="flex flex-col gap-3 font-serif text-[length:var(--text-md)] leading-[var(--leading-normal)] text-[var(--color-ink-muted)]">
            {s.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      ))}

      <p className="font-serif text-[length:var(--text-md)] leading-[var(--leading-normal)] text-[var(--color-ink-muted)]">
        Questions or a request to remove your notes: get in touch through{" "}
        <a
          href="https://lucascosolo.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-ink)] underline underline-offset-4"
        >
          lucascosolo.com
        </a>
        .
      </p>

      <nav aria-label="Ways back">
        <Link
          href="/read/Gen.1"
          className="inline-flex min-h-[var(--touch-target)] items-center font-sans text-[length:var(--text-sm)] text-[var(--color-ink)] underline underline-offset-4"
        >
          Back to reading
        </Link>
      </nav>
    </div>
  );
}
