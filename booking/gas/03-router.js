/**
 * Kinésica GAS — Autenticación por secret, idempotencia, doGet/doPost y accesos a Calendar/Sheets.
 * Archivo parte del proyecto Apps Script (ámbito global compartido). Ver 00-config.js.
 */

// TODO('revisar si hay llamadores externos de check_patient/get_directory')
// check_patient / get_directory / list_appointments: secret == GAS_API_SECRET o WEBHOOK_SECRET.
function secretsMatch(expected, given) {
  if (!expected || !given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

function isAuthorizedSecret(params) {
  const given = params && params.secret != null ? String(params.secret) : "";
  if (!given) return false;
  let candidates = [];
  try {
    const props = PropertiesService.getScriptProperties();
    const gasSecret = props.getProperty("GAS_API_SECRET");
    const webhookSecret = props.getProperty("WEBHOOK_SECRET");
    const pacientesSecret = props.getProperty("PACIENTES_API_SECRET");
    if (gasSecret) candidates.push(gasSecret);
    if (webhookSecret && webhookSecret !== gasSecret) candidates.push(webhookSecret);
    if (pacientesSecret && candidates.indexOf(pacientesSecret) < 0) candidates.push(pacientesSecret);
  } catch (e) {
    candidates = [];
  }
  for (let i = 0; i < candidates.length; i++) {
    if (secretsMatch(candidates[i], given)) return true;
  }
  return false;
}

function unauthorizedResponse() {
  return createJsonResponse({ status: "error", message: "unauthorized" }, 401);
}

function normalizeBookingRequestId(raw) {
  const value = String(raw || "").trim();
  return /^[A-Za-z0-9_-]{12,120}$/.test(value) ? value : "";
}

function getStoredBookingResult(requestId) {
  if (!requestId) return null;
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(BOOKING_IDEMPOTENCY_PREFIX + requestId);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("No se pudo leer la clave idempotente de la reserva: " + e);
    return null;
  }
}

function storeBookingResult(requestId, result) {
  if (!requestId || !result) return;
  try {
    PropertiesService.getScriptProperties().setProperty(
      BOOKING_IDEMPOTENCY_PREFIX + requestId,
      JSON.stringify(result)
    );
  } catch (e) {
    console.error("No se pudo persistir la clave idempotente de la reserva: " + e);
  }
}

function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || "get_slots";

    if (action === "get_slots") {
      return handleGetSlots(params);
    } else if (action === "get_slots_range") {
      return handleGetSlotsRange(params);
    } else if (action === "ping") {
      // Diagnóstico de sólo lectura: de dónde salen los horarios (sin datos de pacientes).
      resolveActivePractitionerHours(params.hours || null);
      return createJsonResponse({
        status: "online",
        service: "Kinésica Calendar Booking API",
        version: "v2-timezone-fixed",
        code_version: GAS_CODE_VERSION,
        calendarName: getKinesicaCalendar().getName(),
        admin_hours: {
          loaded: ADMIN_HOURS_DIAG.loaded,
          http_code: ADMIN_HOURS_DIAG.http_code,
          source: ADMIN_HOURS_DIAG.source,
          fetched_at: ADMIN_HOURS_DIAG.fetched_at,
          error: ADMIN_HOURS_DIAG.error,
          url: ADMIN_HOURS_DIAG.url,
          last_good_at: ADMIN_HOURS_DIAG.last_good_at || null
        }
      });
    } else if (action === "book") {
      return handleBookAppointment(params);
    } else if (action === "cancel") {
      // GET: mismo patrón que book (POST a /exec a veces responde 405 en el deploy público).
      if (!isAuthorizedSecret(params)) return unauthorizedResponse();
      return handleCancelAppointment(params);
    } else if (action === "check_patient") {
      if (!isAuthorizedSecret(params)) return unauthorizedResponse();
      return handleCheckPatient(params);
    } else if (action === "get_directory") {
      if (!isAuthorizedSecret(params)) return unauthorizedResponse();
      return handleGetDirectory();
    } else if (action === "list_appointments") {
      if (!isAuthorizedSecret(params)) return unauthorizedResponse();
      return handleListAppointments(params);
    } else if (action === "check_events") {
      if (!isAuthorizedSecret(params)) return unauthorizedResponse();
      return handleCheckEvents(params);
    }

    return createJsonResponse({ status: "error", message: "Acción no reconocida en GET" }, 400);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() }, 500);
  }
}

function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = {};
      }
    }
    if (e && e.parameter) {
      payload = Object.assign({}, e.parameter, payload);
    }

    const action = payload.action || "book";

    if (action === "check_patient") {
      if (!isAuthorizedSecret(payload)) return unauthorizedResponse();
      return handleCheckPatient(payload);
    } else if (action === "get_directory") {
      if (!isAuthorizedSecret(payload)) return unauthorizedResponse();
      return handleGetDirectory();
    } else if (action === "book") {
      return handleBookAppointment(payload);
    } else if (action === "get_slots") {
      return handleGetSlots(payload);
    } else if (action === "get_slots_range") {
      return handleGetSlotsRange(payload);
    } else if (action === "list_appointments") {
      if (!isAuthorizedSecret(payload)) return unauthorizedResponse();
      return handleListAppointments(payload);
    } else if (action === "check_events") {
      if (!isAuthorizedSecret(payload)) return unauthorizedResponse();
      return handleCheckEvents(payload);
    } else if (action === "cancel") {
      if (!isAuthorizedSecret(payload)) return unauthorizedResponse();
      return handleCancelAppointment(payload);
    } else if (action === "ping") {
      // Diagnóstico de sólo lectura: de dónde salen los horarios (sin datos de pacientes).
      resolveActivePractitionerHours(payload.hours || null);
      return createJsonResponse({
        status: "online",
        service: "Kinésica Calendar Booking API",
        version: "v2-timezone-fixed",
        code_version: GAS_CODE_VERSION,
        calendarName: getKinesicaCalendar().getName(),
        admin_hours: {
          loaded: ADMIN_HOURS_DIAG.loaded,
          http_code: ADMIN_HOURS_DIAG.http_code,
          source: ADMIN_HOURS_DIAG.source,
          fetched_at: ADMIN_HOURS_DIAG.fetched_at,
          error: ADMIN_HOURS_DIAG.error,
          url: ADMIN_HOURS_DIAG.url,
          last_good_at: ADMIN_HOURS_DIAG.last_good_at || null
        }
      });
    }

    return createJsonResponse({ status: "error", message: "Acción no reconocida en POST" }, 400);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() }, 500);
  }
}

/**
 * Obtiene el calendario 'consultorio' de Google Calendar.
 * Usa por defecto el ID oficial del consultorio configurado en Clara (n8n).
 */
function getKinesicaCalendar() {
  const OFFICIAL_CALENDAR_ID = "5b93aq89h77fvfsh28tgufligc@group.calendar.google.com";
  const props = PropertiesService.getScriptProperties();
  const calendarId = props.getProperty("CALENDAR_ID") || OFFICIAL_CALENDAR_ID;

  // 1. Intentar por ID exacto
  try {
    const calById = CalendarApp.getCalendarById(calendarId);
    if (calById) return calById;
  } catch (err) {}

  // 2. Intentar por nombre directo (rápido sin escanear todos los calendarios)
  try {
    const calsLower = CalendarApp.getCalendarsByName("consultorio");
    if (calsLower && calsLower.length > 0) return calsLower[0];
  } catch (e) {}

  try {
    const calsUpper = CalendarApp.getCalendarsByName("Consultorio");
    if (calsUpper && calsUpper.length > 0) return calsUpper[0];
  } catch (e) {}

  // 3. Fallback al calendario por defecto de la cuenta
  return CalendarApp.getDefaultCalendar();
}

/**
 * Obtiene la hoja de Google Sheets de pacientes.
 */
function getPatientsSheet() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty("SPREADSHEET_ID") || "1kyGkYea0Iu_OrXxF-yONqhs2rG1O8YUWbbSmQe37GCk";
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    return ss.getActiveSheet();
  } catch (err) {
    return null;
  }
}
