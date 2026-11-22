/**
 * Kinésica GAS — check_patient y parseo de títulos/descripciones de eventos del calendario.
 * Archivo parte del proyecto Apps Script (ámbito global compartido). Ver 00-config.js.
 */

/**
 * Endpoint POST: Verifica si el paciente ya es habitual buscando en Google Sheets.
 */
function handleCheckPatient(payload) {
  const telefono = String(payload.telefono || "").replace(/[^0-9]/g, "");
  if (!telefono || telefono.length < 8) {
    return createJsonResponse({ status: "error", message: "Teléfono inválido" });
  }

  const targetLast8 = telefono.slice(-8);
  const sheet = getPatientsSheet();

  if (!sheet) {
    return createJsonResponse({ status: "success", is_habitual: false, name: null });
  }

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowPhone = String(data[i][2] || "").replace(/[^0-9]/g, "");
    if (rowPhone && rowPhone.slice(-8) === targetLast8) {
      return createJsonResponse({
        status: "success",
        is_habitual: true,
        nombre: String(data[i][0] || "").trim()
      });
    }
  }

  return createJsonResponse({ status: "success", is_habitual: false, name: null });
}

/**
 * Extrae el slug del profesional desde el título de Calendar
 * (p. ej. "🩺 [NORBERTO] Juan Pérez" → "norberto").
 */
function parsePractitionerIdFromTitle(title) {
  const t = String(title || "").toUpperCase();
  if (t.indexOf("[MARIA]") !== -1 || t.indexOf("[MARÍA]") !== -1) {
    return "maria";
  }
  if (t.indexOf("[NORBERTO]") !== -1) {
    return "norberto";
  }
  return "";
}

/**
 * Extrae el nombre de paciente desde el título de un evento de Calendar
 * (p. ej. "🩺 [NORBERTO] Juan Pérez (Agendó: María)").
 */
function parseAppointmentPatientName(title) {
  let t = String(title || "").trim();
  if (!t || isNonPatientAppointmentTitle(t)) return "";
  // Quitar emoji / símbolos iniciales y tags de profesional / menor.
  t = t.replace(/^[^\wáéíóúÁÉÍÓÚñÑüÜ\[]+/u, "");
  t = t.replace(/^\[[^\]]+\]\s*/g, "");
  t = t.replace(/^\[MENOR\]\s*/i, "");
  t = t.replace(/\s*\((?:Familiar|Agend[oó]|Adulto[^)]*)\s*:[^)]*\)\s*$/iu, "");
  t = t.replace(/\s+/g, " ").trim();
  return isNonPatientAppointmentTitle(t) ? "" : t;
}

/**
 * Detecta eventos que no son turnos de paciente (bloqueos, feriados, TK3, etc.).
 */
function isNonPatientAppointmentTitle(title) {
  const raw = String(title || "").trim();
  if (!raw) return true;
  // Detectar variantes de no dar: "No dar", "No dar: ir a comprar queso", "No-dar", "no_dar", etc.
  if (/(?:^|[\s\-_:\[\(])no[\s\-_]*dar(?:$|[\s\-_:\]\)])/i.test(raw) || /(?:^|[\s\-_:\[\(])no[\s\-_]*dar\b/i.test(raw)) {
    return true;
  }
  if (/(?:^|[\s\-_\[\(])tk[\s\-_]*3(?:$|[\s\-_\]\)])/i.test(raw)) {
    return true;
  }
  let t = raw.toLowerCase();
  try {
    t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (e) {}
  const blocked = [
    "no dar",
    "bloqueado",
    "bloqueo",
    "feriado",
    "vacaciones",
    "vacacion",
    "tk3",
    "tk 3",
    "lista de espera",
    "waitlist",
    "cancelado",
    "anulado",
    "suspendido",
    "baja"
  ];
  for (let i = 0; i < blocked.length; i++) {
    if (t.indexOf(blocked[i]) !== -1) return true;
  }
  return false;
}

/**
 * ¿Título/descripción marcan el turno como cancelado/anulado? (aunque el evento siga en Calendar).
 */
function isCancelledAppointmentText(text) {
  let t = String(text || "").toLowerCase();
  if (!t) return false;
  try {
    t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (e) {}
  const markers = ["cancelado", "anulado", "suspendido", "[baja]"];
  for (let i = 0; i < markers.length; i++) {
    if (t.indexOf(markers[i]) !== -1) return true;
  }
  // "baja" solo como etiqueta, no en apellidos tipo "Bajarotti"
  if (/(?:^|[\s\-_:\[\(])baja(?:$|[\s\-_:\]\)])/i.test(String(text || ""))) return true;
  return false;
}

/**
 * Normaliza claves de "clave:valor" (sin acentos, minúsculas).
 */
function normalizeCalendarKvKey(raw) {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Parsea segmentos clave:valor desde descripción/título (líneas o " | ").
 */
function parseCalendarKvMap(text) {
  const raw = String(text || "").trim();
  if (!raw) return {};
  const chunks = raw.split(/\s*(?:\||\r\n|\r|\n)\s*/);
  const map = {};
  for (let i = 0; i < chunks.length; i++) {
    let chunk = String(chunks[i] || "").trim();
    if (!chunk) continue;
    chunk = chunk.replace(/^[^\wáéíóúÁÉÍÓÚñÑüÜ]+/u, "");
    const m = chunk.match(/^([^:]{1,40})\s*:\s*(.+)$/);
    if (!m) continue;
    const key = normalizeCalendarKvKey(m[1]);
    const val = String(m[2] || "").trim();
    if (!key || !val || map[key]) continue;
    map[key] = val;
  }
  return map;
}

function extractDigitsPhone(raw) {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return digits;
}

function extractDigitsDni(raw) {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (digits.length < 5 || digits.length > 12) return "";
  return digits;
}

/**
 * Teléfono/DNI desde descripción (clave:valor) y fallbacks legacy; el título se conserva como fallback.
 */
function extractContactsFromAppointment(title, description) {
  const phoneKeys = ["telefono", "whatsapp", "wa", "tel", "celular", "movil", "phone"];
  const dniKeys = ["dni", "documento", "doc", "pasaporte", "document", "passport", "ci", "du"];
  const descMap = parseCalendarKvMap(description);
  const titleMap = parseCalendarKvMap(title);
  let phone = "";
  let dni = "";

  for (let i = 0; i < phoneKeys.length; i++) {
    if (!phone && descMap[phoneKeys[i]]) phone = extractDigitsPhone(descMap[phoneKeys[i]]);
  }
  for (let j = 0; j < dniKeys.length; j++) {
    if (!dni && descMap[dniKeys[j]]) dni = extractDigitsDni(descMap[dniKeys[j]]);
  }
  for (let i = 0; i < phoneKeys.length; i++) {
    if (!phone && titleMap[phoneKeys[i]]) phone = extractDigitsPhone(titleMap[phoneKeys[i]]);
  }
  for (let j = 0; j < dniKeys.length; j++) {
    if (!dni && titleMap[dniKeys[j]]) dni = extractDigitsDni(titleMap[dniKeys[j]]);
  }

  // Legacy DNI primero (CI/DU/documento) para no promoverlo a WhatsApp.
  if (!dni) {
    const mDni = String(description || "").match(/\b(?:dni|documento|doc|pasaporte|passport|c\.?i\.?|d\.?u\.?)\b\s*[:#-]?\s*([0-9][0-9.\-\s]{4,18})/i);
    if (mDni) dni = extractDigitsDni(mDni[1]);
  }
  if (!dni) {
    const mTitleDni = String(title || "").match(/\b(?:dni|documento|doc|pasaporte|passport|c\.?i\.?|d\.?u\.?)\b\s*[:#-]?\s*([0-9][0-9.\-\s]{4,18})/i);
    if (mTitleDni) dni = extractDigitsDni(mTitleDni[1]);
  }

  // Legacy descripción: "WhatsApp: …"
  if (!phone) {
    const m = String(description || "").match(/(?:whatsapp|wa\.me|tel|cel|telefono|tel[eé]fono|celular|movil)[:\s\/]*([+]?[-0-9\s()]{8,22})/i);
    if (m) phone = extractDigitsPhone(m[1]);
  }

  // Si el "teléfono" es el DNI (p.ej. 8 dígitos → 54911########), descartarlo.
  if (phone && dni) {
    const phoneDigits = String(phone).replace(/\D+/g, "");
    if (
      phoneDigits === dni ||
      phoneDigits === "11" + dni ||
      phoneDigits === "54911" + dni
    ) {
      phone = "";
    }
  }

  return { phone: phone, dni: dni };
}

/** @deprecated usar extractContactsFromAppointment */
function extractPhoneFromAppointmentDescription(description) {
  return extractContactsFromAppointment("", description).phone;
}
