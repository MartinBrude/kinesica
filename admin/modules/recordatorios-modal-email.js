/**
 * Email y contactos de prueba — recordatorios.
 */

import { getSessionUser } from "./auth.js?v=83";

export const TEST_CONTACT_STORAGE_KEY = "kinesica_recordatorio_test_contact";

const TEST_CONTACT_DEFAULTS = {
  martin: { name: "Martín Brude", phone: "34658444935", email: "martin.brude@gmail.com" },
  norberto: { name: "Norberto Brude", phone: "5491161564311", email: "norberto1712@gmail.com" },
  maria: { name: "María Gulin", phone: "5491128531224", email: "manosmagicas7116@gmail.com" },
};

export function phoneEndsMatch(a, b) {
  const da = String(a || "").replace(/\D+/g, "");
  const db = String(b || "").replace(/\D+/g, "");
  if (da.length < 8 || db.length < 8) return false;
  return da.slice(-10) === db.slice(-10) || da.endsWith(db.slice(-9)) || db.endsWith(da.slice(-9));
}

export function normalizePersonKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resuelve email cuando el item viene sin él (p. ej. caso de prueba / staff no está en pacientes). */
export function resolveRecordatorioEmail(item) {
  const existing = String(item?.email || "").trim().toLowerCase();
  if (existing && existing.includes("@")) return existing;

  const phone = String(item?.wa_id || "").trim();
  const nameKey = normalizePersonKey(item?.patient_name || "");
  for (const known of Object.values(TEST_CONTACT_DEFAULTS)) {
    if (phoneEndsMatch(phone, known.phone)) return known.email;
    const knownKey = normalizePersonKey(known.name);
    if (nameKey && (nameKey === knownKey || nameKey.startsWith(`${knownKey} `) || knownKey.startsWith(`${nameKey} `))) {
      return known.email;
    }
  }
  return "";
}

export function readStoredTestContact() {
  try {
    const raw = localStorage.getItem(TEST_CONTACT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      name: String(parsed.name || "").trim(),
      phone: String(parsed.phone || "").trim(),
      email: String(parsed.email || "").trim(),
    };
  } catch {
    return null;
  }
}

export function storeTestContact(name, phone, email = "") {
  try {
    localStorage.setItem(TEST_CONTACT_STORAGE_KEY, JSON.stringify({ name, phone, email: String(email || "").trim() }));
  } catch {
    /* ignore */
  }
}

export function resolveTestContactDefaults(user) {
  const username = String(user?.username || "").toLowerCase().trim();
  const display = String(user?.name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (TEST_CONTACT_DEFAULTS[username]) return TEST_CONTACT_DEFAULTS[username];
  if (display.includes("norberto")) return TEST_CONTACT_DEFAULTS.norberto;
  if (display.includes("martin")) return TEST_CONTACT_DEFAULTS.martin;
  return null;
}

export function defaultTestContact() {
  const stored = readStoredTestContact();
  if (stored?.name && stored?.phone) return stored;
  const user = getSessionUser();
  const known = resolveTestContactDefaults(user);
  if (known) {
    return {
      name: stored?.name || known.name,
      phone: stored?.phone || known.phone,
      email: stored?.email || known.email || "",
    };
  }
  return {
    name: stored?.name || String(user?.name || "").trim() || "",
    phone: stored?.phone || "",
    email: stored?.email || "",
  };
}
