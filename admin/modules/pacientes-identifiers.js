export function canonicalPatientNameKey(str) {
  if (!str) return "";
  let s = String(str).trim();
  s = s.replace(/^(?:lic\.|lic|dr\.|dr|dra\.|dra|sr\.|sr|sra\.|sra)\s+/iu, "");
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, " ");
  const tokens = s.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return "";
  if (tokens.length >= 2) tokens.sort();
  return tokens.join(" ");
}

export function cleanPatientDni(raw) {
  if (!raw) return "";
  const s = String(raw).trim().toLowerCase();
  if (!s || s === "no provisto" || s === "null") return "";
  const digits = s.replace(/\D/g, "");
  return digits.length >= 5 ? digits : "";
}

export function isPlaceholderPhone(phone) {
  const p = String(phone || "").trim();
  if (!p) return true;
  return p.startsWith("sin-tel-") || p.startsWith("sin-tel") || p.startsWith("sin-telefono") || p.startsWith("ficha-");
}

export function patientMissingPhone(p) {
  if (!p) return false;
  const rawTel = String(p.telefono || "").trim();
  const isPlaceholderTel = isPlaceholderPhone(rawTel);
  const cleanDigits = isPlaceholderTel ? "" : rawTel.replace(/\D/g, "");
  return !cleanDigits || cleanDigits.length < 5;
}

export function countMissingPhoneFromList(list) {
  if (!Array.isArray(list)) return 0;
  return list.filter((p) => patientMissingPhone(p)).length;
}
