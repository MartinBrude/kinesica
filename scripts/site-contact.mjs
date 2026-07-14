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
  /** Schema.org telephone format (E.123-style with dashes). */
  phoneSchema: "+54-11-6156-4311",
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
  geo: {
    latitude: -34.587025,
    longitude: -58.421046,
  },
};

/** Primary clinician — schema, CV, articles. */
export const FOUNDER = {
  name: "Norberto Silvio Brude",
  shortName: "Norberto Brude",
};

/** Opening hours — schema + llms.txt. UI copy per language lives in partials-strings.mjs. */
export const OPENING_HOURS = {
  opens: "10:00",
  closes: "20:00",
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  schemaShort: "Mo-Fr 10:00-20:00",
  /** Plain Spanish line for llms.txt and similar. */
  llmsLine: "lunes a viernes, 10:00–20:00",
};

export const SOCIALS = {
  instagramBusiness: "https://www.instagram.com/kinesicabrude/",
  instagramMaria: "https://www.instagram.com/kinesio_mariagulin/",
  facebookBusiness: "https://www.facebook.com/kinesicabrude/",
  handles: {
    instagramBusiness: "kinesicabrude",
    instagramMaria: "kinesio_mariagulin",
    facebookBusiness: "kinesicabrude",
  },
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

/** Schema.org PostalAddress from CONTACT.address. */
export function postalAddressSchema() {
  const { shortLine: _short, ...rest } = CONTACT.address;
  return {
    "@type": "PostalAddress",
    ...rest,
  };
}

/** Schema.org OpeningHoursSpecification array. */
export function openingHoursSpecification() {
  return [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: OPENING_HOURS.days,
      opens: OPENING_HOURS.opens,
      closes: OPENING_HOURS.closes,
    },
  ];
}

/** Schema.org GeoCoordinates. */
export function geoCoordinatesSchema() {
  return {
    "@type": "GeoCoordinates",
    latitude: CONTACT.geo.latitude,
    longitude: CONTACT.geo.longitude,
  };
}
