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

export function normalizeAuthorKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Merge supplements (first) + API reviews, drop excluded authors, dedupe by author.
 */
export function applyReviewOverrides(
  reviews,
  { excludeAuthors = [], supplements = [] } = {},
) {
  const exclude = new Set(
    (excludeAuthors || []).map(normalizeAuthorKey).filter(Boolean),
  );
  const merged = [...(supplements || []), ...(reviews || [])];
  const seen = new Set();
  const out = [];
  for (const r of merged) {
    if (!r || !String(r.text || "").trim()) continue;
    const key = normalizeAuthorKey(r.author);
    if (!key || exclude.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Pick best reviews: highest rating, then newest, then longest text. */
export function pickReviews(reviews, max = 5) {
  return [...(reviews || [])]
    .filter((r) => r && String(r.text || "").trim())
    .sort((a, b) => {
      const ratingA = Number(a.rating) || 0;
      const ratingB = Number(b.rating) || 0;
      if (ratingB !== ratingA) return ratingB - ratingA;
      const timeA = a.publishTime ? Date.parse(a.publishTime) : 0;
      const timeB = b.publishTime ? Date.parse(b.publishTime) : 0;
      if (timeB !== timeA) return timeB - timeA;
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
