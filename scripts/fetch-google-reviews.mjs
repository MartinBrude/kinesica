#!/usr/bin/env node
/**
 * Fetch Google reviews at build time → partials/google-reviews-data.js
 *
 * Keys con restricción HTTP Referrer: usa headless browser en kinesica.com.ar.
 * Keys de servidor: REST Places API (New).
 *
 *   npm run reviews:fetch
 *   GOOGLE_PLACES_API_KEY=… npm run reviews:fetch
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GOOGLE_PLACE_ID } from "./google-place.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PARTIAL = path.join(ROOT, "partials/google-reviews-data.js");
const SECRETS_FILE = path.join(ROOT, "js/site-secrets.js");
const ORIGIN_URL = "https://www.kinesica.com.ar/";
const MAX_REVIEWS = 5;

function emptyPayload() {
  return {
    placeId: GOOGLE_PLACE_ID,
    fetchedAt: null,
    rating: null,
    userRatingCount: null,
    reviews: [],
  };
}

function readApiKey() {
  const fromEnv = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  if (!fs.existsSync(SECRETS_FILE)) return null;
  const match = fs
    .readFileSync(SECRETS_FILE, "utf8")
    .match(/googlePlacesApiKey:\s*"([^"]+)"/);
  return match?.[1]?.trim() || null;
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
    relativeTime:
      review.relativeTime ||
      review.relativePublishTimeDescription ||
      review.relative_time_description ||
      "",
    publishTime: review.publishTime || null,
  };
}

function buildPayload(raw) {
  const reviews = (raw.reviews || [])
    .slice(0, MAX_REVIEWS)
    .map(normalizeReview)
    .filter((r) => r.text);

  return {
    placeId: GOOGLE_PLACE_ID,
    fetchedAt: new Date().toISOString(),
    displayName: raw.displayName || "Kinésica",
    googleMapsUri: raw.googleMapsUri || null,
    rating: raw.rating ?? null,
    userRatingCount: raw.userRatingCount ?? null,
    reviews,
  };
}

async function fetchFromPlacesApi(apiKey) {
  const url = `https://places.googleapis.com/v1/places/${GOOGLE_PLACE_ID}`;
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
    const err = new Error(`Places API ${res.status}: ${msg}`);
    err.referrerBlocked = /referer|API_KEY_HTTP_REFERRER/i.test(msg);
    throw err;
  }

  return buildPayload({
    displayName: body.displayName?.text,
    googleMapsUri: body.googleMapsUri,
    rating: body.rating,
    userRatingCount: body.userRatingCount,
    reviews: body.reviews,
  });
}

async function fetchViaBrowser(apiKey) {
  let puppeteer;
  try {
    puppeteer = await import("puppeteer");
  } catch {
    throw new Error(
      "Key con restricción referrer: instala puppeteer (npm install) o usa una key de servidor.",
    );
  }

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(ORIGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.addScriptTag({
      url:
        "https://maps.googleapis.com/maps/api/js?key=" +
        encodeURIComponent(apiKey) +
        "&libraries=places&loading=async",
    });

    await page.waitForFunction(
      () => window.google?.maps?.importLibrary,
      { timeout: 45000 },
    );

    const raw = await page.evaluate(async (placeId) => {
      const timeout = new Promise((resolve) =>
        setTimeout(() => resolve({ error: "TIMEOUT" }), 30000),
      );
      const work = (async () => {
        try {
          const { Place } = await google.maps.importLibrary("places");
          const place = new Place({ id: placeId });
          await place.fetchFields({
            fields: ["reviews", "rating", "userRatingCount", "displayName"],
          });
          return {
            displayName: place.displayName,
            rating: place.rating,
            userRatingCount: place.userRatingCount,
            reviews: (place.reviews || []).map((r) => ({
              author: r.authorAttribution?.displayName,
              authorPhoto: r.authorAttribution?.photoURI,
              rating: r.rating,
              text: r.text?.text || "",
              relativeTime: r.relativePublishTimeDescription || "",
            })),
          };
        } catch (e) {
          return { error: String(e) };
        }
      })();
      return Promise.race([work, timeout]);
    }, GOOGLE_PLACE_ID);

    if (raw.error) {
      throw new Error(
        `${raw.error}\n` +
          "Revisá en Google Cloud → Credentials → tu API key:\n" +
          "  • Referrers: https://www.kinesica.com.ar/  (exacto, sin *)\n" +
          "  • Referrers: https://www.kinesica.com.ar/*\n" +
          "  • Referrers: http://localhost:*/*  (para pruebas locales)\n" +
          "  • APIs: Maps JavaScript API + Places API (New)\n" +
          "  • Misma key que en js/site-secrets.js",
      );
    }

    return buildPayload({
      displayName: raw.displayName,
      rating: raw.rating,
      userRatingCount: raw.userRatingCount,
      reviews: raw.reviews,
    });
  } finally {
    await browser.close();
  }
}

function writePartial(payload) {
  const js =
    "/** AUTO-GENERATED — no editar. Fuente: npm run reviews:fetch */\n" +
    `window.KINESICA_GOOGLE_REVIEWS = ${JSON.stringify(payload, null, 2)};\n`;
  fs.writeFileSync(OUT_PARTIAL, js);
}

async function main() {
  const apiKey = readApiKey();
  if (!apiKey) {
    console.warn("Sin API key — escribe js/site-secrets.js o usa GOOGLE_PLACES_API_KEY.");
    writePartial(emptyPayload());
    return;
  }

  let payload;
  try {
    payload = await fetchFromPlacesApi(apiKey);
    console.log("Fetched via Places API (New) REST.");
  } catch (err) {
    if (!err.referrerBlocked) throw err;
    console.warn("REST bloqueado por referrer — usando browser en kinesica.com.ar…");
    payload = await fetchViaBrowser(apiKey);
    console.log("Fetched via Maps JavaScript API (headless).");
  }

  writePartial(payload);
  console.log(
    `Wrote ${payload.reviews.length} review(s) → partials/google-reviews-data.js`,
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
