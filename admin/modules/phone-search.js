/**
 * Búsqueda de teléfonos tolerante al formato: "(+54) 9 11 6116 4311", "6116-4311" o "011 6116 4311"
 * encuentran el número guardado como 5491161164311.
 */
export function phoneQueryVariants(query) {
  const raw = String(query || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 3) return [];
  const variants = new Set([digits]);
  if (raw.startsWith("00") && digits.startsWith("00") && digits.length >= 5) {
    variants.add(digits.slice(2));
  } else if (digits.startsWith("0")) {
    variants.add(digits.slice(1));
  }
  if (digits.startsWith("15") && digits.length === 10) variants.add("11" + digits.slice(2));
  return [...variants];
}

export function phoneMatches(storedPhone, query) {
  const stored = String(storedPhone || "").replace(/\D/g, "");
  if (!stored) return false;
  return phoneQueryVariants(query).some((v) => stored.includes(v));
}
