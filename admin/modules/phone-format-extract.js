/**
 * Extracción de teléfonos desde texto de calendario / resúmenes.
 */

import { cleanPhoneDigits } from "./phone-format-core.js?v=1";

function normalizeCalendarKvKey(raw) {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function extractPhoneFromKv(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const chunks = raw.split(/\s*(?:\||\r\n|\r|\n)\s*/);
  const phoneKeys = new Set(["telefono", "whatsapp", "wa", "tel", "celular", "movil", "phone"]);
  for (const chunk0 of chunks) {
    const chunk = String(chunk0 || "").trim().replace(/^[^\wáéíóúÁÉÍÓÚñÑüÜ]+/u, "");
    const m = chunk.match(/^([^:]{1,40})\s*:\s*(.+)$/);
    if (!m) continue;
    const key = normalizeCalendarKvKey(m[1]);
    if (!phoneKeys.has(key)) continue;
    const digits = cleanPhoneDigits(m[2]);
    if (digits.length >= 8 && digits.length <= 15) return digits;
  }
  return "";
}

export function extractPhoneCandidate(text) {
  if (!text) return "";
  const t = String(text).trim();
  if (!t) return "";

  const fromKv = extractPhoneFromKv(t);
  if (fromKv) return fromKv;

  const mPref = t.match(/(?:(?:whatsapp|wa\.me|tel|cel|telefono|tel[eé]fono|celular|movil)[:\s\/]*)+([+]?[-0-9\s()]{8,22})/i);
  if (mPref) {
    const digits = cleanPhoneDigits(mPref[1]);
    if (digits.length >= 8 && digits.length <= 15) {
      return digits;
    }
  }

  const withoutDni = t.replace(/(?:dni|doc(?:umento)?|c\.?i\.?|d\.?u\.?|pasaporte)[:\s\.]*[\d\.\-]+/gi, " ");

  const mIntl = withoutDni.match(/\+\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
  if (mIntl) {
    return cleanPhoneDigits(mIntl[0]);
  }

  const mAr10 = withoutDni.match(/(?:\+?54\s*9?\s*)?(?:0?11|15)[-.\s]?\d{4}[-.\s]?\d{4}\b/);
  if (mAr10) {
    return cleanPhoneDigits(mAr10[0]);
  }

  const m10 = withoutDni.match(/\b(?:11|15|549)\d{8,10}\b/);
  if (m10) {
    return cleanPhoneDigits(m10[0]);
  }

  const mAny = withoutDni.match(/\b\d{10,13}\b/);
  if (mAny) {
    return cleanPhoneDigits(mAny[0]);
  }

  return "";
}
