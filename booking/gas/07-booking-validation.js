/**
 * Kinésica GAS — Validación de DNI y email para reservas web.
 * Archivo parte del proyecto Apps Script (ámbito global compartido). Ver 00-config.js.
 */

/**
 * DNI/pasaporte — espejo de booking/dni-rules.js (digit 5–12 / alnum 5–20).
 * Verificar: node scripts/verify-booking-dni-rules.mjs
 */
function isValidBookingDni(raw) {
  const s = String(raw || "").trim();
  if (!s || /^no\s*provisto$/i.test(s)) return false;
  const alnum = s.replace(/[^0-9A-Za-z]/g, "");
  if (!alnum) return false;
  if (/[A-Za-z]/.test(alnum)) return alnum.length >= 5 && alnum.length <= 20;
  return alnum.length >= 5 && alnum.length <= 12;
}

function isValidBookingEmail(raw) {
  const s = String(raw || "").trim();
  if (!s || s.length > 120 || /\s/.test(s)) return false;
  const parts = s.split("@");
  if (parts.length !== 2) return false;
  const local = parts[0];
  const domain = parts[1];
  if (!local || !domain || local.length > 64 || domain.length > 253) return false;
  if (local.indexOf(".") === 0 || local.slice(-1) === "." || local.indexOf("..") !== -1) return false;
  if (domain.indexOf(".") === 0 || domain.slice(-1) === "." || domain.indexOf("..") !== -1) return false;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (!/^[A-Za-z]{2,24}$/.test(tld)) return false;
  for (let i = 0; i < labels.length; i++) {
    const lbl = labels[i];
    if (!lbl || lbl.length > 63 || !/^[A-Za-z0-9-]+$/.test(lbl) || lbl.indexOf("-") === 0 || lbl.slice(-1) === "-") {
      return false;
    }
  }
  return true;
}

/** Normaliza y recorta los campos del payload de reserva. */
function readBookingFields(payload) {
  return {
    tipo: payload.tipo || "primera_vez", // 'primera_vez' | 'habitual'
    appointmentType: payload.appointmentType || "session",
    nombre: String(payload.nombre || "").trim().slice(0, 120),
    telefono: String(payload.telefono || "").trim().slice(0, 30),
    email: String(payload.email || "").trim().slice(0, 120),
    dni: String(payload.dni || "No provisto").trim().slice(0, 30),
    dateStr: payload.date, // YYYY-MM-DD
    timeStr: payload.time, // HH:mm
    isMenor: Boolean(payload.isMenor),
    nombreFamiliar: String(payload.nombreFamiliar || "").trim().slice(0, 120),
    esParaTercero: Boolean(payload.esParaTercero || payload.contactoNombre),
    contactoNombre: String(payload.contactoNombre || payload.nombreFamiliar || "").trim().slice(0, 120),
    contactoTelefono: String(payload.contactoTelefono || "").trim().slice(0, 30),
    contactoNotas: String(payload.contactoNotas || "").trim().slice(0, 100),
    notas: String(payload.notas || "").trim().slice(0, 500),
    practitionerId: payload.practitionerId || "",
    bookingRequestId: normalizeBookingRequestId(payload.bookingRequestId)
  };
}

/** Valida tipo, fecha/hora, nombre, teléfono, email y DNI. Devuelve respuesta de error o null. */
function validateBookingFields(f, payload) {
  if (f.appointmentType === "call") {
    return createJsonResponse({
      status: "error",
      message: "Ya no se agendan llamadas. Elegí un turno presencial de 1 hora."
    }, 400);
  }
  if (!f.dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(f.dateStr) || !f.timeStr || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(f.timeStr))) {
    return createJsonResponse({ status: "error", message: "Fecha (YYYY-MM-DD) y hora (HH:mm) son requeridas para la reserva." }, 400);
  }
  if (!f.nombre || f.nombre.length < 3) {
    return createJsonResponse({ status: "error", message: "Nombre completo es requerido" }, 400);
  }
  const phoneDigits = f.telefono.replace(/[^0-9]/g, "");
  if (!phoneDigits || phoneDigits.length < 6 || phoneDigits.length > 16 || /^(\d)\1+$/.test(phoneDigits)) {
    return createJsonResponse({ status: "error", message: "Teléfono válido es requerido" }, 400);
  }
  // adminMode solo con secret (proxy admin/api/booking_admin_book.php). Flag del cliente solo → ignorado.
  const wantsAdmin = payload.adminMode === true || payload.adminMode === "true";
  const isAdminBooking = wantsAdmin && isAuthorizedSecret(payload);
  if ((!f.email && !isAdminBooking) || (f.email && !isValidBookingEmail(f.email))) {
    return createJsonResponse({ status: "error", message: "Correo electrónico válido es requerido" }, 400);
  }
  if (!isAdminBooking) {
    if (!isValidBookingDni(payload.dni)) {
      return createJsonResponse({ status: "error", message: "DNI o documento es requerido" }, 400);
    }
  } else if (String(payload.dni || "").trim() && !isValidBookingDni(payload.dni)) {
    return createJsonResponse({ status: "error", message: "DNI o documento inválido" }, 400);
  }
  return null;
}

/** Anticipación mínima, máximo de días y horario del profesional. Devuelve respuesta de error o null. */
function validateBookingSchedule(f, payload, startTime, duration) {
  // 1. Verificación de anticipación mínima y máximo 60 días
  const now = new Date();
  const todayInArg = Utilities.formatDate(now, "America/Argentina/Buenos_Aires", "yyyy-MM-dd");
  const isToday = (todayInArg === f.dateStr);
  const todayMs = parseArgentinaDate(todayInArg, "00:00").getTime();
  const targetMs = parseArgentinaDate(f.dateStr, "00:00").getTime();
  const diffDays = Math.round((targetMs - todayMs) / (24 * 3600 * 1000));
  if (diffDays < 0) {
    return createJsonResponse({ status: "error", message: "No se pueden agendar turnos en fechas pasadas." }, 400);
  }
  if (diffDays > MAX_BOOKING_DAYS) {
    return createJsonResponse({ status: "error", message: "Los turnos se pueden solicitar a un máximo de " + MAX_BOOKING_DAYS + " días." }, 400);
  }
  const bufferHours = SESSION_BUFFER_HOURS;
  const minAllowedTime = isToday ? (now.getTime() + bufferHours * 3600 * 1000) : parseArgentinaDate(f.dateStr, "08:00").getTime();
  if (startTime.getTime() < minAllowedTime) {
    return createJsonResponse({
      status: "error",
      message: "Los turnos presenciales deben reservarse con al menos 2 horas de anticipación."
    }, 400);
  }

  // 2. Verificación de horario del profesional
  const dayOfWeek = parseArgentinaDate(f.dateStr, "12:00").getUTCDay();
  // Reserva: admin > última copia buena > horarios de la web (validados) > respaldo del código.
  const windows = getGasWorkingWindows(f.practitionerId, dayOfWeek, payload.hours || null, { forBooking: true, date: f.dateStr, overrides: payload.schedule_overrides || payload.overrides });
  const timeParts = f.timeStr.split(":").map(Number);
  const reqMin = timeParts[0] * 60 + timeParts[1];
  const fitsWindow = windows.some(function(w) {
    const sParts = w.start.split(":").map(Number);
    const eParts = w.end.split(":").map(Number);
    return reqMin >= (sParts[0] * 60 + sParts[1]) && reqMin + duration <= (eParts[0] * 60 + eParts[1]);
  });
  if (!fitsWindow) {
    return createJsonResponse({
      status: "error",
      message: "El horario seleccionado está fuera del horario de atención del profesional."
    }, 400);
  }
  return null;
}
