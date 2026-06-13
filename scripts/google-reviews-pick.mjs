/** Pick best reviews for display: 5★ first, then longest text. */
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
