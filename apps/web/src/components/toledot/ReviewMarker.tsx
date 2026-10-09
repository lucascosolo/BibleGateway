import type { ReviewStatus } from "@/lib/db/timeline";
import { getLexiconEntry } from "@/lib/lexicon";

/** The entity's review grade as one quiet sentence: information about the content, not an alert. */
export function ReviewMarker({ status }: { status: ReviewStatus }) {
  const { gloss } = getLexiconEntry(`review-${status}`);
  return (
    <p className="toledot-review" role="note" aria-label={`Review grade: ${gloss}`}>
      {gloss}
    </p>
  );
}
