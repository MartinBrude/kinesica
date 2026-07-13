/**
 * Single source of truth for clinic contact + social profiles.
 * Used by generators (schema, partials, CV, etc.) and optionally by browser config.
 */
import { GOOGLE_MAPS_URL } from "./google-place.mjs";

export const CONTACT = {
  /** WhatsApp phone in international format (digits only, no +). */
  whatsappDigits: "5491161564311",
  /** Human-readable phone for UI. */
  phoneDisplay: "+54 (11) 6156-4311",
  /** Primary email for contact. */
  email: "norberto1712@gmail.com",
  /** Google Maps short link (same as Google Business Profile listing). */
  mapsUrl: GOOGLE_MAPS_URL,
  /** Clinic address (UI + schema). */
  address: {
    streetAddress: "Charcas 3889",
    addressLocality: "Ciudad Autónoma de Buenos Aires",
    addressRegion: "CABA",
    postalCode: "C1425",
    addressCountry: "AR",
    shortLine: "Charcas 3889, CABA",
  },
};

export const SOCIALS = {
  instagramBusiness: "https://www.instagram.com/kinesicabrude/",
  instagramMaria: "https://www.instagram.com/kinesio_mariagulin/",
  facebookBusiness: "https://www.facebook.com/kinesicabrude/",
};

export function waMeUrl(digits = CONTACT.whatsappDigits) {
  return `https://wa.me/${String(digits).replace(/\D/g, "")}`;
}

export function telUrl(digits = CONTACT.whatsappDigits) {
  return `tel:+${String(digits).replace(/\D/g, "")}`;
}

export function mailtoUrl(email = CONTACT.email) {
  return `mailto:${String(email).trim()}`;
}

