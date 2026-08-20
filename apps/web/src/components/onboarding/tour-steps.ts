import type { LexiconId } from "@/lib/lexicon";

/**
 * What the guided tour says.
 *
 * Kept as data, separate from the dialog that shows it, for two reasons. The obvious one is that
 * copy changes far more often than a focus trap does. The less obvious one is that this file is
 * a legible list of every claim the app makes about itself on first run — which makes it possible
 * to check those claims against what the app actually does. A tour that describes a feature the
 * build does not have is worse than no tour, because the reader then spends their time looking
 * for it.
 *
 * Every step answers two questions, in this order: **what is this**, and **why is it here**.
 * The second is the one most product tours skip, and it is the one that makes a tool make sense
 * — "search is here" teaches nothing; "search only reads the English translation, so there is a
 * separate place for the Hebrew and Greek" teaches you how the whole thing is arranged.
 *
 * Written for someone who has never opened a study Bible. No jargon that is not immediately
 * unpacked, and no assumed knowledge of Hebrew, Greek, textual criticism or church history.
 */

export interface TourStep {
  /** Stable id, used as the React key and in the step's heading anchor. */
  id: string;
  /** The heading. Plain English — the Hebrew term, where there is one, comes from `lexiconId`. */
  title: string;
  /** Which lexicon entry names this feature, if any. Shown beside the title with its gloss. */
  lexiconId?: LexiconId;
  /** The icon key from `WORKSPACE_ICONS`, when the step is about a nav destination. */
  icon?: string;
  /** What it is. One or two short sentences. */
  what: string;
  /** Why it exists — the design reason, not a benefit claim. */
  why: string;
  /** Optional link the reader can follow to try it, shown as "See it" on the step. */
  href?: string;
  hrefLabel?: string;
  /**
   * Renders the live settings panel (`<TourSetup>`) beneath this step's copy.
   *
   * A flag rather than a second list, because a setup step is still a step: it has the same
   * heading, the same "why it is here", the same dot in the progress row and the same Skip
   * button. Only its body is different.
   */
  setup?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "A Bible for reading closely",
    what:
      "Jot shows you the text and, beside it, the evidence about the text: where translations disagree, which verses some Bibles leave out, which passages quote each other, and what the Hebrew and Greek actually say.",
    why:
      "Most Bible apps are built for reading a chapter a day. This one is built for the moment you stop and ask why a verse says what it says — and it tries to hand you the sources rather than an opinion.",
  },
  {
    id: "read",
    title: "Read",
    icon: "book",
    href: "/read/John.3",
    hrefLabel: "Open John 3",
    // Written as "when you open it", not "at the top of this page". The tour is a centred card
    // on whatever page you happen to be on — usually the home page — so a step that points at
    // controls the reader cannot currently see is describing furniture in another room.
    what:
      "The reader: open a passage and you get the text, with a control for switching between seven translations, a button at the foot for citing what you are reading, and ] and [ to move between chapters without reaching for the mouse (press ? there for the full list of keys).",
    why:
      "Switching translation keeps your exact place, down to the verse, because every verse has one address that does not depend on which Bible you are reading. That is what makes comparing translations something you do in passing rather than something you set up. At the foot of every passage there is also a “Cite this passage” button, which gives you a reference you can put in a footnote — including the id of the exact version of the text you were reading.",
  },
  {
    id: "pardes",
    title: "Reading layers",
    lexiconId: "pardes",
    what:
      "A panel of switches — verse numbers, your highlights, your notes, cross-references, and the scholarly notes about the text. Turn on what you want to see.",
    why:
      "All of this could be on the page at once, and then the page would be unreadable. Making each one a switch means the apparatus is available without being imposed: you decide how much you want beside the text today.",
  },
  {
    id: "selah",
    title: "Reading mode",
    lexiconId: "selah",
    what:
      "One button that hides every layer at once, leaving nothing but the text. Press it again to bring everything back exactly as it was.",
    why:
      "Close reading and plain reading are different activities, and a tool built for the first can get in the way of the second. This is the way out, and it does not cost you your settings.",
  },
  {
    id: "derash",
    title: "Search",
    lexiconId: "derash",
    icon: "search",
    href: "/derash?q=shepherd",
    hrefLabel: "Try a search",
    what:
      "Word search across the English translation. It understands word endings, so searching for \"love\" also finds \"loved\" and \"loves\".",
    why:
      "It searches the English, not the original — so it finds the translator's word choices, which is useful and is also a real limit. When you want the word underneath, that is the next stop.",
  },
  {
    id: "lashon",
    title: "Word study",
    lexiconId: "lashon",
    icon: "root",
    href: "/lashon",
    hrefLabel: "Look up a word",
    what:
      "The Hebrew and Greek behind the translation. Look up a word and you get every place it occurs, which books it clusters in, and every grammatical form it takes. In the reader you can also switch on a word-by-word view beneath each verse.",
    why:
      "Every English Bible is a series of choices, and the same Hebrew word can become \"mercy\" in one verse and \"loyalty\" in the next. Seeing all of a word's occurrences at once shows you the range no single English word can carry — that is the difference between reading a translation and reading through one.",
  },
  {
    id: "annotate",
    title: "Notes and highlights",
    what:
      "Select any stretch of text to highlight it or attach a note. They are yours, they stay on your device, and they are attached to the verse rather than to the page.",
    why:
      "Because they are attached to the verse, a note you make while reading John 3 is still there when the same verse turns up in a search result or a cross-reference — anywhere the verse appears, your note appears with it.",
  },
  {
    id: "roadmap",
    title: "What is not built yet",
    icon: "roadmap",
    href: "/roadmap",
    hrefLabel: "See the roadmap",
    what:
      "A page listing the parts of Jot that are planned but not finished — a timeline, a manuscript history, an atlas, reading plans, and more.",
    why:
      "A research tool that quietly hides its gaps is not one you can trust. Everything unfinished is named, in the open, so you always know what you are and are not looking at.",
  },
  {
    id: "setup",
    title: "Set it up before you start",
    setup: true,
    what:
      "Every default Jot ships with, in one place: light or dark, which Bible opens first, and which of the layers you have just read about are on. Changes take effect as you make them.",
    why:
      "The defaults are one opinion about how to read, and it is a cautious one — the interlinear is off, the reference heat is off, because a page that arrives dense is a page most people close. Someone who came here for the Hebrew should not have to discover that it exists. This is the screen that lets you disagree with us before you have read a verse.",
  },
  {
    id: "reopen",
    title: "That is the tour",
    what:
      "You can reopen this guide whenever you like: the “Guide” button beside the reading controls, or the link near the top of the home page.",
    why:
      "Nothing here is hidden behind having paid attention the first time.",
  },
];
