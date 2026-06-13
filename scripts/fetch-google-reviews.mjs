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
  const serverKey = process.env.GOOGLE_PLACES_SERVER_KEY?.trim();
  if (serverKey) return { key: serverKey, kind: "server" };

  const fromEnv = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (fromEnv) return { key: fromEnv, kind: "browser" };

  if (!fs.existsSync(SECRETS_FILE)) return null;
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
      "Key con restricción referrer: instala puppeteer (npm install) o usa GOOGLE_PLACES_SERVER_KEY.",
    );
  }

  const http = await import("http");
  const port = 9200 + Math.floor(Math.random() * 800);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async"></script>
<script>
(async () => {
  try {
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("maps timeout")), 25000);
      const check = () => {
        if (window.google?.maps?.importLibrary) { clearTimeout(t); res(); }
        else setTimeout(check, 100);
      };
      check();
    });
    const { Place } = await google.maps.importLibrary("places");
    const place = new Place({ id: ${JSON.stringify(GOOGLE_PLACE_ID)} });
    await place.fetchFields({ fields: ["reviews", "rating", "userRatingCount", "displayName"] });
    window.__KINESICA_REVIEWS__ = {
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
    window.__KINESICA_REVIEWS__ = { error: String(e) };
  }
})();
</script></body></html>`;

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "localhost", resolve);
  });

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${port}/`, {
      waitUntil: "networkidle0",
      timeout: 45000,
    });
    await page.waitForFunction(() => window.__KINESICA_REVIEWS__, {
      timeout: 35000,
    });
    const raw = await page.evaluate(() => window.__KINESICA_REVIEWS__);

    if (raw.error) {
      throw new Error(
        `${raw.error}\n` +
          "Revisá en Google Cloud → Credentials → tu API key:\n" +
          "  • Referrers: https://www.kinesica.com.ar/  (exacto, sin *)\n" +
          "  • Referrers: https://www.kinesica.com.ar/*\n" +
          "  • Referrers: http://localhost:*/*  (build + dev local)\n" +
          "  • APIs: Maps JavaScript API + Places API (New)\n" +
          "  • O creá GOOGLE_PLACES_SERVER_KEY sin restricción de referrer (solo IP)",
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
    server.close();
  }
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
    console.warn(
      "Sin API key — js/site-secrets.js, GOOGLE_PLACES_API_KEY o GOOGLE_PLACES_SERVER_KEY.",
    );
    writePartial(emptyPayload());
    return;
  }

  const { key: apiKey, kind } = keyInfo;
  let payload;

  if (kind === "server") {
    payload = await fetchFromPlacesApi(apiKey);
    console.log("Fetched via Places API (New) REST (server key).");
  } else {
    try {
      payload = await fetchFromPlacesApi(apiKey);
      console.log("Fetched via Places API (New) REST.");
    } catch (err) {
      if (!err.referrerBlocked) throw err;
      console.warn("REST bloqueado por referrer — usando browser en localhost…");
      payload = await fetchViaBrowser(apiKey);
      console.log("Fetched via Maps JavaScript API (headless localhost).");
    }
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
