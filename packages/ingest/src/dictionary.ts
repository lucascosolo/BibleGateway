import { existsSync, readFileSync } from "node:fs";

/**
 * Vocabulary baseline for the verse-text integrity gate in `normalize-text.ts`.
 *
 * The gate flags a token as a possible weld when both halves are real words but the whole is
 * not — that is what separates "windblows" (a footnote was stripped from between "wind" and
 * "blows") from "lampstand" (an ordinary compound). The heuristic is high-recall by design
 * and cannot tell those two apart on its own: a corpus cross-check does not help either,
 * because WEB writes "lampstand" where BSB writes "lamp stand", so the spaced form occurs
 * either way.
 *
 * So this set is a *reviewed baseline* rather than a lexicon. Every entry below was produced
 * by the gate against the current corpus and confirmed by eye to be a genuine word in the
 * published translation, not a weld. The gate stays a hard build failure, which means a
 * refreshed or re-sourced corpus that welds a new pair fails loudly instead of quietly
 * shipping a corrupted verse.
 *
 * Adding an entry is therefore a deliberate act: check the token against the published text
 * of the translation it came from before allowing it through. Two families appear here that
 * are not compounds at all —
 *   - fragments of hyphenated words, which tokenize on the hyphen ("wise-hearted" -> "hearted")
 *   - fragments of hyphenated proper nouns ("Kir-hareseth" -> "hareseth", "Beth-shemesh")
 */
export const LEGITIMATE_COMPOUNDS: ReadonlySet<string> = new Set([
  "aftergrowth", "apostleship", "assaria", "baldhead", "birthstools", "bloodguilt",
  "boastings", "bondservant", "bondservants", "bowshot", "breastpiece", "capstone",
  "chainwork", "choirmaster", "coastland", "coastlands", "companionships", "conjury",
  "coppersmith", "covetings", "cupbearer", "cupbearers", "denarius", "discipleship",
  "dispossessors", "doorframe", "doorframes", "doorkeeper", "doorkeepers", "doorpost",
  "doorposts", "dunghill", "dunghills", "evildoing", "exaction", "facedown", "farmlands",
  "faultfinder", "firelight", "firepans", "firepot", "firstfruits", "floodwaters",
  "foreknew", "foreknown", "forepart", "frontlets", "gatekeeper", "gatekeepers",
  "grainfield", "grainfields", "grasslands", "gravediggers", "groomsmen", "guideposts",
  "handbreadth", "handbreadths", "handmill", "hardworking", "hareseth", "hearted",
  "inkhorn", "lampstand", "lampstands", "longstanding", "lustfulness", "manslayer",
  "metalsmiths", "metalworker", "moneylender", "nationhood", "oppressions", "outflow",
  "outpoured", "overfed", "pastureland", "pasturelands", "pleadings", "proconsul",
  "proconsuls", "reprover", "riverbank", "saddlecloths", "seagull", "seedtime",
  "sevenfold", "sheepherders", "sheepshearers", "shemesh", "shipmaster", "shittim",
  "shophan", "showbread", "simplehearted", "sixtyfold", "skillfulness", "slingstones", "sonship",
  "soothsaying", "spearmen", "stinkweed", "stonecutters", "stonemasons", "superscription",
  "swamplands", "tentmakers", "thirtyfold", "thornbush", "thornbushes", "trackless",
  "undergird", "underway", "vinedressers", "waterless", "waterpots", "wheelwork",
  "windblown", "winepress", "winepresses", "wineskin", "wineskins", "woodworker",
  "yokefellow",
]);

const DICTIONARY_PATHS = [
  "/usr/share/dict/american-english",
  "/usr/share/dict/words",
  "/usr/dict/words",
];

/**
 * Returns a membership test over the system word list plus {@link LEGITIMATE_COMPOUNDS}.
 *
 * Throws when no system word list is present. That is deliberate: silently degrading to an
 * empty dictionary would make the weld detector match nothing and the gate would "pass" on
 * a corpus full of corruption, which is the exact failure this whole mechanism exists to
 * prevent. A missing dictionary is an environment problem and should read as one.
 */
export function loadDictionary(): (word: string) => boolean {
  const found = DICTIONARY_PATHS.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `No system word list found (looked in ${DICTIONARY_PATHS.join(", ")}). ` +
        `The verse-text integrity gate cannot run without one. On Debian/Ubuntu: apt-get install wamerican`,
    );
  }

  const words = new Set(
    readFileSync(found, "utf8")
      .split("\n")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean),
  );

  return (word: string) => words.has(word) || LEGITIMATE_COMPOUNDS.has(word);
}
