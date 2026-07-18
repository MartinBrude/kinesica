#!/usr/bin/env node
/**
 * Generate js/site-config.js from single-source contact/social config.
 * Run via build pipeline before minification.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  GOOGLE_PLACE_ID,
  googleReviewWriteUrl,
  googleReviewsListUrl,
} from "./google-place.mjs";
import { BUSINESS_ID } from "./schema-local-business.mjs";
import { CONTACT, SOCIALS } from "./site-contact.mjs";
import {
  GA4_MEASUREMENT_ID,
  GTM_CONTAINER_ID,
} from "./site-analytics.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "js/site-config.js");

// Browser-only config (not contact data).
const GOOGLE_PLACES_API_KEY = "AIzaSyA6qg_adYYVgTZG3iUjxY-8EuXK5H2HmpE";

const content = [
  "/** Global site configuration. AUTO-GENERATED — do not edit.",
  " * Sources: site-contact.mjs, google-place.mjs, site-analytics.mjs",
  " */",
  "window.KINESICA_SITE = {",
  "  /** Google Tag Manager container. */",
  `  gtmContainerId: ${JSON.stringify(GTM_CONTAINER_ID)},`,
  "  /** GA4 measurement ID (via GTM Google Tag + conversion events). */",
  `  ga4MeasurementId: ${JSON.stringify(GA4_MEASUREMENT_ID)},`,
  "  /** Google Maps short link (same as Google Business Profile listing). */",
  `  googleMapsUrl: ${JSON.stringify(CONTACT.mapsUrl)},`,
  "  /** Google Business Profile place ID (Charcas 3889). */",
  `  googlePlaceId: ${JSON.stringify(GOOGLE_PLACE_ID)},`,
  "  /** Direct link to leave a Google review (place ID). */",
  `  googleReviewUrl: ${JSON.stringify(googleReviewWriteUrl())},`,
  "  /** Direct link to read Google reviews (same place ID). */",
  `  googleReviewsListUrl: ${JSON.stringify(googleReviewsListUrl())},`,
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
