"use client";

import { useEffect } from "react";

import { useAudioStore, type ReaderPassage } from "@/lib/store/audio";

/**
 * The reader page's side of the player: publish what is on screen, and mark the verse being
 * read.
 *
 * Publishes on mount and withdraws on unmount. The withdrawal is conditional: when a chapter
 * ends with the screen locked, the player has already moved the store to the next chapter
 * before the route changes, and the old page leaving must not clear it. The withdrawal is what stops playback when
 * the reader leaves for the concordance; the re-publish from the next chapter's page is what
 * lets playback continue across a chapter boundary — the player compares slugs and decides.
 *
 * The highlight is applied to the DOM directly rather than through a per-verse subscription.
 * Every `<Verse>` already subscribes to its annotation atom; adding a second subscription for
 * a value that changes several times a minute would re-render the verse each time the reader
 * breathes. Toggling one class on one element by `data-verse-id` costs nothing and is exactly
 * as universal — any surface that renders the verse with THE renderer carries the attribute.
 */
export function ReaderAudio({ passage }: { passage: ReaderPassage }) {
  const publish = useAudioStore((s) => s.publish);
  const withdraw = useAudioStore((s) => s.withdraw);
  const currentVerseId = useAudioStore((s) => s.currentVerseId);
  const status = useAudioStore((s) => s.status);
  const open = useAudioStore((s) => s.open);

  useEffect(() => {
    publish(passage);
    return () => withdraw(passage.slug, passage.translationCode);
    // The passage object is rebuilt per render of the server page; its slug and translation
    // are its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage.slug, passage.translationCode]);

  useEffect(() => {
    const active = open && currentVerseId !== null && status !== "idle";
    const root = document.querySelector(".reader");
    if (!root) return;
    root.querySelectorAll<HTMLElement>(".verse--playing").forEach((el) => el.classList.remove("verse--playing"));
    if (!active) return;
    const el = root.querySelector<HTMLElement>(`[data-verse-id="${currentVerseId}"]`);
    if (!el) return;
    el.classList.add("verse--playing");
    // Follow the reader down the page, but only when the verse has left the viewport: a page
    // the user is scrolling by hand should not fight them for every verse.
    const r = el.getBoundingClientRect();
    if (status === "playing" && (r.top < 0 || r.bottom > window.innerHeight)) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [currentVerseId, status, open]);

  return null;
}
