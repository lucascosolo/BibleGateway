import type { LexiconId } from "@/lib/lexicon";

export interface Workspace {
  key: string;
  href: string;
  plainLabel: string;
  /** Undefined when the workspace has no authentic term — "Read" stays plain per §4.6 rule 5. */
  lexiconId?: LexiconId;
  icon: string;
  /**
   * Undefined for a workspace that actually exists behind its nav link. "planned" means the
   * route resolves to a real page — never a dead link — but that page states honestly it is
   * not built yet and says what phase it lands in (ARCHITECTURE.md §6).
   */
  status?: "planned";
  /** Which phase of §6 the workspace ships in — only meaningful when `status` is "planned". */
  phase?: number;
}

/**
 * Primary nav used to give three of five slots to Toledot/Geniza/Massa'ot — unbuilt roadmap
 * pages with no data — leaving only Read and Derash actually working. An adversarial review
 * called that out: empty roadmap pages should not occupy primary navigation, especially when a
 * daily user's own notebook is one tap away only by URL. The roadmap remains linked from the
 * guided tour and the home/about surfaces; the primary slots go to working research surfaces.
 */
export const WORKSPACES: Workspace[] = [
  { key: "read", href: "/read", plainLabel: "Read", icon: "book" },
  { key: "derash", href: "/derash", plainLabel: "Search", lexiconId: "derash", icon: "search" },
  // Derash searches the English translation and says so in its own gloss. Lashon is the other
  // half of that sentence: the Hebrew/Aramaic/Greek word index, where a lemma or Strong's number
  // resolves to every occurrence in the text. It sits in primary nav rather than behind the
  // interlinear because "look this word up everywhere" is the first thing a researcher does, and
  // a tool that can only be reached from a verse you already found is a tool most people never
  // find at all.
  // "Word study" rather than the lexicon's "Original language": a nav label has to fit beside
  // three others at 768px, and it should say what you DO here, not what the text is made of.
  { key: "lashon", href: "/lashon", plainLabel: "Word study", lexiconId: "lashon", icon: "root" },
  { key: "notes", href: "/notes", plainLabel: "Notes", icon: "notes" },
];

/**
 * Not a member of `WORKSPACES`: its href is `/`, and `AppShell`'s `useActiveWorkspace` matches
 * by `pathname.startsWith(ws.href)` — every route starts with `/`, so mixed into the shared list
 * it would shadow every other workspace's own match. `NavRail` and `TopTabs` also already carry
 * their own link home on the wordmark, so this is BottomTabBar's alone: rendered there as a
 * raised, brand-colored button in the middle slot rather than a plain tab.
 */
export const HOME_WORKSPACE: Workspace = { key: "home", href: "/", plainLabel: "Home", icon: "home" };

/** The workspaces named above but not yet built — surfaced on `/roadmap`, not in primary nav. */
export const PLANNED_WORKSPACES: Workspace[] = [
  {
    key: "toledot",
    href: "/toledot",
    plainLabel: "Timeline",
    lexiconId: "toledot",
    icon: "timeline",
    status: "planned",
    phase: 2,
  },
  {
    key: "geniza",
    href: "/geniza",
    plainLabel: "Manuscripts",
    lexiconId: "geniza",
    icon: "scroll",
    status: "planned",
    phase: 3,
  },
  {
    key: "massaot",
    href: "/massaot",
    plainLabel: "Atlas",
    lexiconId: "massaot",
    icon: "map",
    status: "planned",
    phase: 4,
  },
];
