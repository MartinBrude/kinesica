#!/usr/bin/env node
/**
 * Fetch Google reviews at build time → partials/google-reviews-data.js
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
import {
  OUT_PARTIAL,
  emptyPayload,
  readApiKey,
  readExistingPayload,
  googleReviewsAggregateRating,
  reviewsContentKey,
  writePartial,
} from "./google-reviews-io.mjs";

export {
  OUT_PARTIAL,
  emptyPayload,
  readApiKey,
  readExistingPayload,
  googleReviewsAggregateRating,
  reviewsContentKey,
  writePartial,
};

const MAX_REVIEWS = 5;

function normalizeReview(review) {
  const text =
    typeof review.text === "string"
      ? review.text
      : review.text?.text || review.originalText?.text || "";
  return {
    author: review.author || review.authorAttribution?.displayName || review.author_name || "Google user",
    authorPhoto: review.authorPhoto || review.authorAttribution?.photoUri || review.profile_photo_url || null,
    authorProfile: review.authorAttribution?.uri || null,
    rating: review.rating ?? null,
    text: text.trim(),
    language: review.language || review.text?.languageCode || review.originalText?.languageCode || null,
    relativeTime: review.relativeTime || review.relativePublishTimeDescription || review.relative_time_description || "",
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
  return { rating: body.rating ?? null, userRatingCount: body.userRatingCount ?? null };
}

async function fetchLangFromPlacesApi(apiKey, lang) {
  const body = await placesGet(
    apiKey,
    "reviews,rating,userRatingCount,displayName,googleMapsUri",
    placesLanguageCode(lang),
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

function setGithubOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) fs.appendFileSync(file, `${name}=${value}\n`);
}

export async function syncGoogleReviews({ ifChanged = false } = {}) {
  const keyInfo = readApiKey();
  if (!keyInfo) {
    if (ifChanged) {
      throw new Error("Sin API key (GOOGLE_PLACES_SERVER_KEY / GOOGLE_PLACES_API_KEY). Abortando sync.");
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
  console.log(`  stored: ${storedCount ?? "?"} · live: ${liveMeta.userRatingCount ?? "?"} · rating ${liveMeta.rating ?? "?"}`);
  setGithubOutput("stored_count", String(storedCount ?? ""));
  setGithubOutput("live_count", String(liveMeta.userRatingCount ?? ""));

  console.log("Fetching reviews (ES/EN/FR/PT)…");
  const payload = await fetchAllLanguages(keyInfo.key);
  console.log("Fetched via Places API (New) REST.");

  const changed = reviewsContentKey(existing) !== reviewsContentKey(payload);
  if (ifChanged && !changed) {
    console.log("Sin cambios en rating/count/reseñas mostradas — no se actualiza el partial.");
    setGithubOutput("changed", "false");
    return { changed: false, payload: existing, liveMeta };
  }

  writePartial(payload);
  console.log(`Wrote partial → partials/google-reviews-data.js (${payload.reviews.length} ES reviews)`);
  if (payload.rating != null) console.log(`Aggregate: ${payload.rating} (${payload.userRatingCount ?? "?"} ratings)`);
  if (ifChanged) console.log("Contenido mostrado actualizado (corresponde refresh del index).");
  setGithubOutput("changed", "true");
  return { changed: true, payload, liveMeta };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  syncGoogleReviews({ ifChanged: process.argv.includes("--if-changed") }).catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
