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

export const REVIEW_LANG_CODES = ["es", "en", "fr", "pt"];

/** Maps site lang → Places API languageCode. */
export function placesLanguageCode(lang) {
  if (lang === "es") return "es";
  if (lang === "fr") return "fr";
  if (lang === "pt") return "pt";
  return "en";
}
