import { formatPatientName } from "./pacientes-name.js";

export const GOOGLE_REVIEW_INVITE_URL = "https://search.google.com/local/writereview?placeid=ChIJZ2mPW9K1vJUR3J5kGRi5gws";

export function getPatientFirstName(p) {
  let raw = (p?.nombre_pila || "").trim();
  if (!raw) {
    const formatted = formatPatientName(p);
    raw = (formatted?.nombre || "").trim();
  }
  if (!raw && p?.nombre) {
    raw = String(p.nombre).trim();
  }
  if (!raw && p?.nombre_completo) {
    const clean = String(p.nombre_completo).trim().replace(/^(lic\.|dr\.|dra\.|sr\.|sra\.)\s+/i, "");
    if (clean.includes(",")) {
      const parts = clean.split(",");
      raw = (parts[1] || parts[0]).trim();
    } else {
      raw = clean;
    }
  }

  if (!raw || raw.toLowerCase() === "paciente" || raw.toLowerCase() === "sin nombre") {
    return "";
  }

  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  let first = words[0];
  if (words.length >= 2) {
    const compound = first.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (["maria", "juan", "ana", "jose"].includes(compound)) {
      first = `${first} ${words[1]}`;
    }
  }

  return first
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function buildReviewInviteMessage(p) {
  const firstName = getPatientFirstName(p);
  const saludo = firstName ? `Hola ${firstName}!` : "Hola!";
  return `${saludo}\nTe escribo de Kinésica. Esperamos que te estés sintiendo muy bien.\nSi tenés un minuto, nos ayudaría mucho a crecer una breve reseña de tu experiencia: ${GOOGLE_REVIEW_INVITE_URL}\n¡Muchas gracias por tu apoyo!`;
}

export function patientEncuestaEnviada(p) {
  return Boolean(p && (Number(p.encuesta_enviada) === 1 || p.encuesta_enviada === true || p.encuesta_enviada === "1"));
}

export function patientHasReview(p) {
  if (p && (Number(p.dejo_review) === 1 || p.dejo_review === true || p.dejo_review === "1")) {
    return true;
  }
  const reviews = typeof window !== "undefined" && window.KINESICA_GOOGLE_REVIEWS?.reviews;
  if (!Array.isArray(reviews) || reviews.length === 0) return false;

  const normalize = (str) =>
    String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

  const pFull = normalize(p?.nombre_completo || `${p?.nombre || ""} ${p?.apellido || ""}`);
  const pNom = normalize(p?.nombre || "");
  const pAp = normalize(p?.apellido || "");

  return reviews.some((r) => {
    const auth = normalize(r?.author || "");
    if (!auth) return false;
    if (pFull && (auth === pFull || auth.includes(pFull) || pFull.includes(auth))) return true;
    if (pNom && pAp && auth.includes(pNom) && auth.includes(pAp)) return true;
    return false;
  });
}
