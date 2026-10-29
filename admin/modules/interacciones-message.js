/**
 * Kinésica Admin - Generador de Mensajes para WhatsApp
 * Construye el mensaje preescrito de seguimiento para contactar pacientes desde el panel.
 */

export function resolveSenderName(userOrName) {
  let raw = "";

  if (typeof userOrName === "string") {
    raw = userOrName;
  } else if (userOrName && typeof userOrName === "object") {
    raw = userOrName.first_name || userOrName.name || userOrName.username || "";
  }

  if (!raw && typeof localStorage !== "undefined") {
    try {
      raw = localStorage.getItem("kinesica_user_name") || "";
    } catch (_) {}
  }

  const str = String(raw || "").trim();
  if (!str) return "Norberto";

  if (/mar[ií]a/i.test(str)) return "María";
  if (/mart[ií]n/i.test(str)) return "Martín";
  if (/norberto/i.test(str)) return "Norberto";

  const cleaned = str.replace(/^(lic\.|dr\.|dra\.|licda\.)\s+/i, "").trim();
  const firstWord = cleaned.split(/\s+/)[0] || "";
  if (!firstWord) return "Norberto";

  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
}

export function buildWhatsAppFollowupMessage(userOrName) {
  const name = resolveSenderName(userOrName);
  return `Buen día!\nSoy ${name}, de Kinésica.\nVi que estuviste consultando para coordinar un turno pero no llegamos a agendar.\n¿Te quedó alguna duda? ¿Querés que agendemos la sesión?`;
}

export function buildWhatsAppUrl(waId, userOrName) {
  const cleanWa = String(waId || "").replace(/[^0-9]/g, "");
  if (!cleanWa) return "#";
  const msg = buildWhatsAppFollowupMessage(userOrName);
  return `https://wa.me/${cleanWa}?text=${encodeURIComponent(msg)}`;
}
