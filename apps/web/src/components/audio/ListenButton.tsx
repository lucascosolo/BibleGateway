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
 *
 * A translation with no recording of its own gets an unavailable Listen button, not a button
 * that quietly plays a different edition: the reader asked for this translation, and the
 * picker marks the ones that can be heard. Where the Hebrew is recorded it is offered
 * separately, by name, so the original is still one tap away.
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

  const play = (choice: EditionChoice) => {
    setChoice(choice);
    send({ kind: "play", verseId: null });
  };

  if (choices.includes("translation")) {
    return (
      <button
        type="button"
        className="reader__listen"
        onClick={() => play("translation")}
        title="Listen from the selected verse, or the top of the page"
      >
        <SpeakerIcon className="reader__listen-icon" />
        Listen
      </button>
    );
  }

  return (
    <span className="reader__listen-group">
      <button
        type="button"
        className="reader__listen reader__listen--none"
        aria-disabled="true"
        title={`No recording of the ${translationCode} for this page. Translations with audio carry a speaker mark in the translation list.`}
      >
        <SpeakerIcon className="reader__listen-icon" />
        No {translationCode} audio
      </button>
      {choices.includes("original") && (
        <button
          type="button"
          className="reader__listen reader__listen--alt"
          onClick={() => play("original")}
          title="Listen to the Hebrew reading of this passage"
        >
          Hebrew
        </button>
      )}
    </span>
  );
}
