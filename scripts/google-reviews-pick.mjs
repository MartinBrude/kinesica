/**
 * Reorder picked reviews (length-desc) for visual balance:
 * long text at edges, shortest near center.
 * Indices refer to positions in the length-sorted pick.
 */
const BALANCE_PERM = {
  1: [0],
  2: [0, 1],
  3: [0, 2, 1],
  4: [0, 2, 3, 1],
  5: [0, 2, 4, 3, 1],
};

export function balanceReviewOrder(picked) {
  const n = picked.length;
  const perm = BALANCE_PERM[n];
  if (!perm) return picked;
  return perm.map((i) => picked[i]);
}

/** Pick best reviews: highest rating, then longest text. */
export function pickReviews(reviews, max = 5) {
  return [...(reviews || [])]
    .filter((r) => r && String(r.text || "").trim())
    .sort((a, b) => {
      const ratingA = Number(a.rating) || 0;
      const ratingB = Number(b.rating) || 0;
      if (ratingB !== ratingA) return ratingB - ratingA;
      return String(b.text).length - String(a.text).length;
    })
    .slice(0, max);
}

/** Pick + balanced layout for display (extremes dense, center lighter). */
export function pickReviewsForDisplay(reviews, max = 5) {
  return balanceReviewOrder(pickReviews(reviews, max));
}

export const REVIEW_LANG_CODES = ["es", "en", "fr", "pt"];

/** Maps site lang → Places API languageCode. */
export function placesLanguageCode(lang) {
  if (lang === "es") return "es";
  if (lang === "fr") return "fr";
  if (lang === "pt") return "pt";
  return "en";
}
