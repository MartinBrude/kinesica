/**
 * I/O, API key resolution, AggregateRating and content fingerprinting for Google reviews.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GOOGLE_PLACE_ID } from "./google-place.mjs";
import { REVIEW_LANG_CODES } from "./google-reviews-pick.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const OUT_PARTIAL = path.join(ROOT, "partials/google-reviews-data.js");
const SECRETS_FILE = path.join(ROOT, "js/site-secrets.js");

export function emptyPayload() {
  return {
    placeId: GOOGLE_PLACE_ID,
    fetchedAt: null,
    rating: null,
    userRatingCount: null,
    reviews: [],
    byLang: {},
    translations: {},
  };
}

export function readApiKey() {
  const serverKey = process.env.GOOGLE_PLACES_SERVER_KEY?.trim();
  if (serverKey) return { key: serverKey, kind: "server" };

  const fromEnv = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (fromEnv) return { key: fromEnv, kind: "browser" };

  const target = fs.existsSync(SECRETS_FILE) ? SECRETS_FILE : path.join(ROOT, "js/site-config.js");
  if (!fs.existsSync(target)) return null;
  const match = fs.readFileSync(target, "utf8").match(/googlePlacesApiKey:\s*"([^"]+)"/);
  const key = match?.[1]?.trim() || null;
  return key ? { key, kind: "browser" } : null;
}

export function readExistingPayload() {
  if (!fs.existsSync(OUT_PARTIAL)) return emptyPayload();
  const raw = fs.readFileSync(OUT_PARTIAL, "utf8");
  const match = raw.match(/window\.KINESICA_GOOGLE_REVIEWS\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!match) return emptyPayload();
  try {
    return JSON.parse(match[1]);
  } catch {
    return emptyPayload();
  }
}

/** Schema.org AggregateRating from the last Places fetch, or null if missing. */
export function googleReviewsAggregateRating() {
  const payload = readExistingPayload();
  const ratingValue = Number(payload.rating);
  const ratingCount = Number(payload.userRatingCount);
  if (!Number.isFinite(ratingValue) || ratingValue <= 0 || !Number.isFinite(ratingCount) || ratingCount < 1) {
    return null;
  }
  return { "@type": "AggregateRating", ratingValue, bestRating: 5, worstRating: 1, ratingCount };
}

/** Stable fingerprint of what the home shows (ignore fetchedAt + relativeTime drift). */
export function reviewsContentKey(payload) {
  const byLang = {};
  for (const lang of REVIEW_LANG_CODES) {
    const list = payload?.byLang?.[lang] || (lang === "es" ? payload?.reviews : []) || [];
    byLang[lang] = list.map((r) => ({
      author: r.author || null,
      rating: r.rating ?? null,
      text: String(r.text || "").trim(),
      publishTime: r.publishTime || null,
      authorPhoto: r.authorPhoto || null,
      authorProfile: r.authorProfile || null,
      language: r.language || null,
    }));
  }
  return JSON.stringify({
    rating: payload?.rating ?? null,
    userRatingCount: payload?.userRatingCount ?? null,
    byLang,
  });
}

export function writePartial(payload) {
  const js =
    "/** AUTO-GENERATED — no editar. Fuente: npm run reviews:fetch */\n" +
    `window.KINESICA_GOOGLE_REVIEWS = ${JSON.stringify(payload, null, 2)};\n`;
  fs.writeFileSync(OUT_PARTIAL, js);
}
