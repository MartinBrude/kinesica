/**
 * Kinésica Admin - Generador de Mensajes para WhatsApp
 * Construye el mensaje preescrito de seguimiento para contactar pacientes desde el panel.
 */

export function resolveSenderName(userOrName) {
  let raw = "";

  if (typeof userOrName === "string") {
    raw = userOrName;
  } else if (userOrName && typeof userOrName === "object") {
    const fullFromParts = [userOrName.first_name, userOrName.last_name]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
    raw = fullFromParts || userOrName.name || userOrName.first_name || userOrName.username || "";
  }

  if (!raw && typeof localStorage !== "undefined") {
    try {
      raw = localStorage.getItem("kinesica_user_name") || "";
    } catch { /* ignore */ }
  }

  const str = String(raw || "").trim();
  if (!str) return "Norberto Brude";

  if (/mar[ií]a/i.test(str)) return "María Gulin";
  if (/mart[ií]n/i.test(str)) return "Martín Brude";
  if (/norberto/i.test(str)) return "Norberto Brude";
  if (/facundo/i.test(str)) return "Facundo Vivardo";

  const cleaned = str.replace(/^(lic\.|dr\.|dra\.|licda\.)\s+/i, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Norberto Brude";

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
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
