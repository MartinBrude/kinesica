#!/usr/bin/env node
/**
 * Fetch Google reviews at build time → partials/google-reviews-data.js
 * One fetch per site language (languageCode) so ES/EN/FR/PT get localized text
 * and relative times from Google.
 *
 *   npm run reviews:fetch
 *   npm run reviews:fetch -- --if-changed   # write only if displayed content changed
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GOOGLE_PLACE_ID } from "./google-place.mjs";
import {
  REVIEW_LANG_CODES,
  applyReviewOverrides,
  localizeReviews,
  pickReviews,
  placesLanguageCode,
} from "./google-reviews-pick.mjs";
import {
  EXCLUDE_AUTHORS,
  REVIEW_BODY_BY_AUTHOR,
  SUPPLEMENT_REVIEWS,
} from "./google-reviews-overrides.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const OUT_PARTIAL = path.join(ROOT, "partials/google-reviews-data.js");
const SECRETS_FILE = path.join(ROOT, "js/site-secrets.js");
const MAX_REVIEWS = 5;

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

  if (!fs.existsSync(SECRETS_FILE)) {
    const cfg = path.join(ROOT, "js/site-config.js");
    if (fs.existsSync(cfg)) {
      const match = fs
        .readFileSync(cfg, "utf8")
        .match(/googlePlacesApiKey:\s*"([^"]+)"/);
      const key = match?.[1]?.trim() || null;
      if (key) return { key, kind: "browser" };
    }
    return null;
  }
  const match = fs
    .readFileSync(SECRETS_FILE, "utf8")
    .match(/googlePlacesApiKey:\s*"([^"]+)"/);
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
  if (
    !Number.isFinite(ratingValue) ||
    ratingValue <= 0 ||
    !Number.isFinite(ratingCount) ||
    ratingCount < 1
  ) {
    return null;
  }
  return {
    "@type": "AggregateRating",
    ratingValue,
    bestRating: 5,
    worstRating: 1,
    ratingCount,
  };
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

function normalizeReview(review) {
  const text =
    typeof review.text === "string"
      ? review.text
      : review.text?.text || review.originalText?.text || "";
  return {
    author:
      review.author ||
      review.authorAttribution?.displayName ||
      review.author_name ||
      "Google user",
    authorPhoto:
      review.authorPhoto ||
      review.authorAttribution?.photoUri ||
      review.profile_photo_url ||
      null,
    authorProfile: review.authorAttribution?.uri || null,
    rating: review.rating ?? null,
    text: text.trim(),
    language:
      review.language ||
      review.text?.languageCode ||
      review.originalText?.languageCode ||
      null,
    relativeTime:
      review.relativeTime ||
      review.relativePublishTimeDescription ||
      review.relative_time_description ||
      "",
    publishTime: review.publishTime || null,
  };
}

async function placesGet(apiKey, fieldMask, languageCode) {
  const url = languageCode
    ? `https://places.googleapis.com/v1/places/${GOOGLE_PLACE_ID}?languageCode=${languageCode}`
    : `https://places.googleapis.com/v1/places/${GOOGLE_PLACE_ID}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  });
  const body = await res.json();
  if (!res.ok) {
    const msg = body.error?.message || res.statusText;
    const err = new Error(`Places API ${res.status}: ${msg}`);
    err.referrerBlocked = /referer|API_KEY_HTTP_REFERRER/i.test(msg);
    throw err;
  }
  return body;
}

/** Lightweight check: aggregate rating + review count only. */
export async function fetchReviewMeta(apiKey) {
  const body = await placesGet(apiKey, "rating,userRatingCount");
  return {
    rating: body.rating ?? null,
    userRatingCount: body.userRatingCount ?? null,
  };
}

async function fetchLangFromPlacesApi(apiKey, lang) {
  const languageCode = placesLanguageCode(lang);
  const body = await placesGet(
    apiKey,
    "reviews,rating,userRatingCount,displayName,googleMapsUri",
    languageCode,
  );

  const fromApi = (body.reviews || []).map(normalizeReview);
  const curated = applyReviewOverrides(fromApi, {
    excludeAuthors: EXCLUDE_AUTHORS,
    supplements: SUPPLEMENT_REVIEWS[lang] || [],
  });
  const localized = localizeReviews(curated, lang, REVIEW_BODY_BY_AUTHOR);

  return {
    displayName: body.displayName?.text,
    googleMapsUri: body.googleMapsUri,
    rating: body.rating,
    userRatingCount: body.userRatingCount,
    reviews: pickReviews(localized, MAX_REVIEWS),
  };
}

export async function fetchAllLanguages(apiKey) {
  const byLang = {};
  let meta = null;

  for (const lang of REVIEW_LANG_CODES) {
    const data = await fetchLangFromPlacesApi(apiKey, lang);
    byLang[lang] = data.reviews;
    if (!meta) {
      meta = {
        displayName: data.displayName,
        googleMapsUri: data.googleMapsUri,
        rating: data.rating,
        userRatingCount: data.userRatingCount,
      };
    }
    console.log(`  ${lang}: ${data.reviews.length} review(s)`);
  }

  return {
    placeId: GOOGLE_PLACE_ID,
    fetchedAt: new Date().toISOString(),
    displayName: meta?.displayName || "Kinésica",
    googleMapsUri: meta?.googleMapsUri || null,
    rating: meta?.rating ?? null,
    userRatingCount: meta?.userRatingCount ?? null,
    reviews: byLang.es || [],
    byLang,
    translations: REVIEW_BODY_BY_AUTHOR,
  };
}

export function writePartial(payload) {
  const js =
    "/** AUTO-GENERATED — no editar. Fuente: npm run reviews:fetch */\n" +
    `window.KINESICA_GOOGLE_REVIEWS = ${JSON.stringify(payload, null, 2)};\n`;
  fs.writeFileSync(OUT_PARTIAL, js);
}

function setGithubOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  fs.appendFileSync(file, `${name}=${value}\n`);
}

export async function syncGoogleReviews({ ifChanged = false } = {}) {
  const keyInfo = readApiKey();
  if (!keyInfo) {
    if (ifChanged) {
      throw new Error(
        "Sin API key (GOOGLE_PLACES_SERVER_KEY / GOOGLE_PLACES_API_KEY). Abortando sync.",
      );
    }
    console.warn("Sin API key — js/site-config.js o GOOGLE_PLACES_SERVER_KEY.");
    writePartial(emptyPayload());
    setGithubOutput("changed", "true");
    return { changed: true, reason: "empty-no-key" };
  }

  const existing = readExistingPayload();
  const storedCount = existing.userRatingCount ?? null;

  console.log("Checking review count…");
  const liveMeta = await fetchReviewMeta(keyInfo.key);
  console.log(
    `  stored: ${storedCount ?? "?"} · live: ${liveMeta.userRatingCount ?? "?"} · rating ${liveMeta.rating ?? "?"}`,
  );
  setGithubOutput("stored_count", String(storedCount ?? ""));
  setGithubOutput("live_count", String(liveMeta.userRatingCount ?? ""));

  console.log("Fetching reviews (ES/EN/FR/PT)…");
  const payload = await fetchAllLanguages(keyInfo.key);
  console.log("Fetched via Places API (New) REST.");

  const changed =
    reviewsContentKey(existing) !== reviewsContentKey(payload);

  if (ifChanged && !changed) {
    console.log(
      "Sin cambios en rating/count/reseñas mostradas — no se actualiza el partial.",
    );
    setGithubOutput("changed", "false");
    return { changed: false, payload: existing, liveMeta };
  }

  writePartial(payload);
  console.log(
    `Wrote partial → partials/google-reviews-data.js (${payload.reviews.length} ES reviews)`,
  );
  if (payload.rating != null) {
    console.log(
      `Aggregate: ${payload.rating} (${payload.userRatingCount ?? "?"} ratings)`,
    );
  }
  if (ifChanged) {
    console.log("Contenido mostrado actualizado (corresponde refresh del index).");
  }
  setGithubOutput("changed", "true");
  return { changed: true, payload, liveMeta };
}

async function main() {
  const ifChanged = process.argv.includes("--if-changed");
  await syncGoogleReviews({ ifChanged });
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
