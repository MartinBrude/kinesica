/** Google Business Profile — Kinésica, Charcas 3889 (Palermo). */
export const GOOGLE_PLACE_ID = "ChIJZ2mPW9K1vJUR3J5kGRi5gws";

export const GOOGLE_MAPS_URL = "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9";

export function googleReviewWriteUrl(placeId = GOOGLE_PLACE_ID) {
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}

export function googleReviewsListUrl(placeId = GOOGLE_PLACE_ID) {
  return `https://search.google.com/local/reviews?placeid=${placeId}`;
}
