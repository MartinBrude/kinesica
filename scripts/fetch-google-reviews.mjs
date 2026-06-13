#!/usr/bin/env node
/**
 * Fetch Google reviews at build time → partials/google-reviews-data.js
 * Single Places API call in Spanish (languageCode=es). EN/FR/PT pages use the
 * same review text until translations are added to byLang.
 *
 *   npm run reviews:fetch
 *
 * Cost: 1 request per run — well within Google Maps $200/mo free credit
 * (e.g. weekly cron ≈ 4 requests/month).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GOOGLE_PLACE_ID } from "./google-place.mjs";
import { pickReviews } from "./google-reviews-pick.mjs";

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

async function fetchSpanishReviews(apiKey) {
  const url = `https://places.googleapis.com/v1/places/${GOOGLE_PLACE_ID}?languageCode=es`;
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
    const err = new Error(`Places API ${res.status} (es): ${msg}`);
    err.referrerBlocked = /referer|API_KEY_HTTP_REFERRER/i.test(msg);
    throw err;
  }

  const reviews = pickReviews(
    (body.reviews || []).map(normalizeReview),
    MAX_REVIEWS,
  );

  return {
    displayName: body.displayName?.text,
    googleMapsUri: body.googleMapsUri,
    rating: body.rating,
    userRatingCount: body.userRatingCount,
    reviews,
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

  const data = await fetchSpanishReviews(keyInfo.key);
  console.log("Fetched via Places API (New) REST (languageCode=es).");
  console.log(`  es: ${data.reviews.length} review(s)`);

  const payload = {
    placeId: GOOGLE_PLACE_ID,
    fetchedAt: new Date().toISOString(),
    displayName: data.displayName || "Kinésica",
    googleMapsUri: data.googleMapsUri || null,
    rating: data.rating ?? null,
    userRatingCount: data.userRatingCount ?? null,
    reviews: data.reviews,
    /** Populated when translated copies exist; until then JS falls back to reviews. */
    byLang: {},
  };

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
