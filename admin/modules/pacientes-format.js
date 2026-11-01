/**
 * Kinésica Admin - Formateo y Validación de Teléfonos y Correos (Pacientes)
 * Utilidades para normalización de teléfonos, formato internacional y detección de errores de tipeo.
 */

export { formatDisplayPhone, cleanPhoneDigits } from "./phone-format.js";

export function isValidAdminEmail(raw) {
  const s = String(raw || "").trim();
  if (!s) return true;
  if (s.length > 120 || /\s/.test(s)) return false;
  const parts = s.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain || local.length > 64 || domain.length > 253) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (!/^[A-Za-z]{2,24}$/.test(tld)) return false;
  return labels.every((lbl) => lbl.length > 0 && lbl.length <= 63 && /^[A-Za-z0-9-]+$/.test(lbl) && !lbl.startsWith("-") && !lbl.endsWith("-"));
}

export function suggestAdminEmailDomain(raw) {
  const s = String(raw || "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at === -1) return null;
  const domain = s.slice(at + 1);
  if (!domain) return null;

  const typoMap = {
    "gmai.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "gmail.con": "gmail.com",
    "gemail.com": "gmail.com",
    "gmail.co": "gmail.com",
    "hotmial.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "hotamail.com": "hotmail.com",
    "hotmaill.com": "hotmail.com",
    "hotmail.con": "hotmail.com",
    "outloo.com": "outlook.com",
    "outlok.com": "outlook.com",
    "outlock.com": "outlook.com",
    "outlook.con": "outlook.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "yahoo.con": "yahoo.com",
    "iclud.com": "icloud.com",
    "icoud.com": "icloud.com",
    "icloud.con": "icloud.com",
  };
  if (typoMap[domain]) return typoMap[domain];
  if (domain.endsWith(".con") && domain.length > 5) {
    return domain.slice(0, -4) + ".com";
  }
  return null;
}

export function inspectAdminPhone(raw) {
  const trimmed = String(raw || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 16 || /^(\d)\1+$/.test(digits)) {
    return { valid: false, standard: false, digits };
  }
  const hasIntlPrefix = trimmed.startsWith("+") || trimmed.startsWith("00");
  const isStandardAr =
    (/^549?\d{10}$/.test(digits)) ||
    (/^0?(?:11|[23]\d{2,3})\d{6,8}$/.test(digits) && digits.length >= 10 && digits.length <= 11) ||
    (/^0?1115\d{8}$/.test(digits)) ||
    (/^15\d{8}$/.test(digits)) ||
    (/^\d{8}$/.test(digits) && !hasIntlPrefix);
  const isStandardIntl =
    (hasIntlPrefix && digits.length >= 8 && digits.length <= 15) ||
    (/^(?:34\d{9}|598\d{8,9}|56\d{9}|55\d{10,11}|595\d{9}|591\d{8}|51\d{9}|57\d{10}|52\d{10}|1\d{10}|44\d{10}|33\d{9}|39\d{9,10}|49\d{10,11})$/.test(digits));
  return {
    valid: true,
    standard: Boolean(isStandardAr || isStandardIntl),
    digits,
  };
}
