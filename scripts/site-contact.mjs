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

/**
 * Opening hours — single source for schema, llms.txt, and header UI.
 * Change only `opens` / `closes` (and `days` if needed); derived fields follow.
 */
export const OPENING_HOURS = {
  opens: "08:00",
  closes: "19:00",
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
};

Object.assign(OPENING_HOURS, {
  schemaShort: `Mo-Fr ${OPENING_HOURS.opens}-${OPENING_HOURS.closes}`,
  /** Plain Spanish line for llms.txt and similar. */
  llmsLine: `lunes a viernes, ${OPENING_HOURS.opens}–${OPENING_HOURS.closes}`,
});

/** Parse "HH:MM" → { hour, minute }. */
function parseHm(hm) {
  const [hour, minute] = String(hm).split(":").map(Number);
  return { hour, minute };
}

/** 24h clock label without leading zero when minutes are :00 (e.g. 8, 19). */
function hour24(hm) {
  const { hour, minute } = parseHm(hm);
  return minute === 0 ? String(hour) : `${hour}:${String(minute).padStart(2, "0")}`;
}

/** English 12h clock (e.g. 8 a.m., 7 p.m.). */
function hourEn12(hm) {
  const { hour, minute } = parseHm(hm);
  const suffix = hour < 12 || hour === 24 ? "a.m." : "p.m.";
  let h12 = hour % 12;
  if (h12 === 0) h12 = 12;
  const time = minute === 0 ? String(h12) : `${h12}:${String(minute).padStart(2, "0")}`;
  return `${time} ${suffix}`;
}

/**
 * Header schedule HTML per language, derived from OPENING_HOURS.
 * @param {"es"|"en"|"fr"|"pt"} lang
 */
export function scheduleHeaderHtml(lang) {
  const open = OPENING_HOURS.opens;
  const close = OPENING_HOURS.closes;
  const o24 = hour24(open);
  const c24 = hour24(close);
  switch (lang) {
    case "en":
      return `Monday to Friday: <strong>${hourEn12(open)} to ${hourEn12(close)}</strong>`;
    case "fr":
      return `Lundi au vendredi : <strong>${o24} h à ${c24} h</strong>`;
    case "pt":
      return `Segunda a sexta: <strong>${o24} h às ${c24} h</strong>`;
    case "es":
    default:
      return `Lunes a viernes: <strong>${o24} a ${c24} h</strong>`;
  }
}

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
