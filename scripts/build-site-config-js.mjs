#!/usr/bin/env node
/**
 * Generate js/site-config.js from single-source contact/social config.
 * Run via build pipeline before minification.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONTACT, SOCIALS } from "./site-contact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "js/site-config.js");

// Keep these here (browser-only config). They are not contact data.
const GOOGLE_PLACE_ID = "ChIJZ2mPW9K1vJUR3J5kGRi5gws";
const GOOGLE_PLACES_API_KEY = "AIzaSyA6qg_adYYVgTZG3iUjxY-8EuXK5H2HmpE";
const BUSINESS_ID = "https://www.kinesica.com.ar/#kinesica";

const googleReviewUrl = `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`;
const googleReviewsListUrl = `https://search.google.com/local/reviews?placeid=${GOOGLE_PLACE_ID}`;

const content = [
  "/** Global site configuration. AUTO-GENERATED — do not edit.",
  " * Source of truth: scripts/site-contact.mjs (contact + socials)",
  " */",
  "window.KINESICA_SITE = {",
  "  /** Google Maps short link (same as Google Business Profile listing). */",
  `  googleMapsUrl: ${JSON.stringify(CONTACT.mapsUrl)},`,
  "  /** Google Business Profile place ID (Charcas 3889). */",
  `  googlePlaceId: ${JSON.stringify(GOOGLE_PLACE_ID)},`,
  "  /** Direct link to leave a Google review (place ID). */",
  `  googleReviewUrl: ${JSON.stringify(googleReviewUrl)},`,
  "  /** Direct link to read Google reviews (same place ID). */",
  `  googleReviewsListUrl: ${JSON.stringify(googleReviewsListUrl)},`,
  "  /**",
  "   * Maps JavaScript API key (referrer-restricted in Google Cloud).",
  "   * Override locally via js/site-secrets.js if needed.",
  "   */",
  `  googlePlacesApiKey: ${JSON.stringify(GOOGLE_PLACES_API_KEY)},`,
  "  /** Schema.org @id de la clínica (SEO local). */",
  `  businessId: ${JSON.stringify(BUSINESS_ID)},`,
  "  contact: {",
  `    whatsappDigits: ${JSON.stringify(CONTACT.whatsappDigits)},`,
  `    phoneDisplay: ${JSON.stringify(CONTACT.phoneDisplay)},`,
  `    email: ${JSON.stringify(CONTACT.email)},`,
  "  },",
  "  socials: {",
  `    instagramBusiness: ${JSON.stringify(SOCIALS.instagramBusiness)},`,
  `    instagramMaria: ${JSON.stringify(SOCIALS.instagramMaria)},`,
  `    facebookBusiness: ${JSON.stringify(SOCIALS.facebookBusiness)},`,
  "  },",
  "};",
  "",
].join("\n");

fs.writeFileSync(OUT, content);
console.log("wrote:", path.relative(ROOT, OUT));

