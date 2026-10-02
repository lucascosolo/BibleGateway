"use client";

import type { EditionChoice } from "@/lib/audio/select";
import { useAudioStore } from "@/lib/store/audio";
import { SpeakerIcon } from "./icons";

/**
 * The reader header's way in. Play starts at the verse the reader has selected (a caret in a
 * verse counts), else at the top of the page; the player bar appears at the bottom.
 *
 * `choices` is decided on the server from the audio artifact, so the button knows before any
 * click whether this translation has a recording, whether only the Hebrew does, or whether
 * there is nothing — and says which, rather than opening an empty bar.
 */
export function ListenButton({
  choices,
  translationCode,
}: {
  choices: EditionChoice[];
  translationCode: string;
}) {
  const send = useAudioStore((s) => s.send);
  const setChoice = useAudioStore((s) => s.setChoice);
  const choice = useAudioStore((s) => s.choice);

  if (choices.length === 0) {
    return (
      <span className="reader__listen reader__listen--none" title={`No recording of ${translationCode} for this page.`}>
        <SpeakerIcon className="reader__listen-icon" />
        No audio
      </span>
    );
  }

  const onlyOriginal = !choices.includes("translation");
  return (
    <button
      type="button"
      className="reader__listen"
      onClick={() => {
        // If the current preference cannot play here but the other can, switch rather than
        // open a bar that says no.
        if (!choices.includes(choice)) setChoice(choices[0]);
        send({ kind: "play", verseId: null });
      }}
      title={
        onlyOriginal
          ? `No ${translationCode} recording; listen to the Hebrew instead.`
          : "Listen from the selected verse, or the top of the page"
      }
    >
      <SpeakerIcon className="reader__listen-icon" />
      {onlyOriginal ? "Listen (Hebrew)" : "Listen"}
    </button>
  );
}
