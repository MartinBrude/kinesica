#!/usr/bin/env node
/**
 * Fetch Google reviews at build time → partials/google-reviews-data.js
 * One fetch per site language (languageCode) so ES/EN/FR/PT get localized text
 * and relative times from Google.
 *
 *   npm run reviews:fetch
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GOOGLE_PLACE_ID } from "./google-place.mjs";
import {
  REVIEW_LANG_CODES,
  pickReviews,
  placesLanguageCode,
} from "./google-reviews-pick.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PARTIAL = path.join(ROOT, "partials/google-reviews-data.js");
const SECRETS_FILE = path.join(ROOT, "js/site-secrets.js");
const MAX_REVIEWS = 5;

function emptyPayload() {
  return {
    placeId: GOOGLE_PLACE_ID,
    fetchedAt: null,
    rating: null,
    userRatingCount: null,
    reviews: [],
    byLang: {},
  };
}

function readApiKey() {
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

async function fetchLangFromPlacesApi(apiKey, lang) {
  const languageCode = placesLanguageCode(lang);
  const url = `https://places.googleapis.com/v1/places/${GOOGLE_PLACE_ID}?languageCode=${languageCode}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "reviews,rating,userRatingCount,displayName,googleMapsUri",
    },
  });

  const body = await res.json();
  if (!res.ok) {
    const msg = body.error?.message || res.statusText;
    const err = new Error(`Places API ${res.status} (${lang}): ${msg}`);
    err.referrerBlocked = /referer|API_KEY_HTTP_REFERRER/i.test(msg);
    throw err;
  }

  return {
    displayName: body.displayName?.text,
    googleMapsUri: body.googleMapsUri,
    rating: body.rating,
    userRatingCount: body.userRatingCount,
    reviews: pickReviews(
      (body.reviews || []).map(normalizeReview),
      MAX_REVIEWS,
    ),
  };
}

async function fetchAllLanguages(apiKey) {
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
  };
}

function writePartial(payload) {
  const js =
    "/** AUTO-GENERATED — no editar. Fuente: npm run reviews:fetch */\n" +
    `window.KINESICA_GOOGLE_REVIEWS = ${JSON.stringify(payload, null, 2)};\n`;
  fs.writeFileSync(OUT_PARTIAL, js);
}

async function main() {
  const keyInfo = readApiKey();
  if (!keyInfo) {
    console.warn("Sin API key — js/site-config.js o GOOGLE_PLACES_SERVER_KEY.");
    writePartial(emptyPayload());
    return;
  }

  const payload = await fetchAllLanguages(keyInfo.key);
  console.log("Fetched via Places API (New) REST.");

  writePartial(payload);
  console.log(
    `Wrote partial → partials/google-reviews-data.js (${payload.reviews.length} ES reviews)`,
  );
  if (payload.rating != null) {
    console.log(
      `Aggregate: ${payload.rating} (${payload.userRatingCount ?? "?"} ratings)`,
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
