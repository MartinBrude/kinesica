/**
 * Kinésica - Webhook de Google Apps Script para Reservas Web y Google Calendar
 * ==============================================================================
 * Este script se puede desplegar como una Aplicación Web en Google Apps Script
 * (con permisos para Google Calendar y Google Sheets).
 *
 * Configuración en Google Apps Script:
 * 1. Abrir: https://script.google.com/
 * 2. Crear un nuevo proyecto (o agregar este código al proyecto existente de Kinésica).
 * 3. En Configuración del proyecto -> Propiedades de la secuencia de comandos:
 *    - CALENDAR_NAME: "consultorio" (o dejar vacío para usar el calendario principal).
 *    - SPREADSHEET_ID: "1kyGkYea0Iu_OrXxF-yONqhs2rG1O8YUWbbSmQe37GCk"
 * 4. Implementar -> Nueva implementación -> Tipo: "Aplicación web":
 *    - Ejecutar como: "Yo" (tu cuenta de Google con acceso al calendario).
 *    - Quién tiene acceso: "Cualquier persona" (para permitir peticiones desde la web).
 * 5. Copiar la URL generada y asignarla en js/site-config.js o en el widget de turnos.
 */

// Duración y franjas de Kinésica
const CALL_DURATION_MINUTES = 10;
const SESSION_DURATION_MINUTES = 60;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 19;
const SAME_DAY_BUFFER_HOURS = 2;

// Feriados Oficiales de Argentina
const ARGENTINA_HOLIDAYS = [
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-24", "2026-04-02",
  "2026-04-03", "2026-05-01", "2026-05-25", "2026-06-15", "2026-06-20",
  "2026-07-09", "2026-08-17", "2026-10-12", "2026-11-23", "2026-12-08",
  "2026-12-25", "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-24",
  "2027-03-26", "2027-04-02", "2027-05-01", "2027-05-25", "2027-06-20",
  "2027-07-09", "2027-08-16", "2027-10-11", "2027-11-20", "2027-12-08",
  "2027-12-25"
];

function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || "get_slots";

    if (action === "get_slots") {
      return handleGetSlots(params);
    } else if (action === "ping") {
      return createJsonResponse({ status: "online", service: "Kinésica Calendar Booking API" });
    }

    return createJsonResponse({ status: "error", message: "Acción no reconocida en GET" }, 400);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() }, 500);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: "error", message: "No post data received" }, 400);
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || "book";

    if (action === "check_patient") {
      return handleCheckPatient(payload);
    } else if (action === "book") {
      return handleBookAppointment(payload);
    }

    return createJsonResponse({ status: "error", message: "Acción no reconocida en POST" }, 400);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() }, 500);
  }
}

/**
 * Obtiene el calendario 'consultorio' de Google Calendar.
 */
function getKinesicaCalendar() {
  const props = PropertiesService.getScriptProperties();
  const calendarName = props.getProperty("CALENDAR_NAME") || "consultorio";
  const calendars = CalendarApp.getCalendarsByName(calendarName);
  if (calendars && calendars.length > 0) {
    return calendars[0];
  }
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

/**
 * Endpoint GET: Devuelve los horarios libres para un día y tipo de turno.
 */
function handleGetSlots(params) {
  const dateStr = params.date; // YYYY-MM-DD
  const type = params.type || "call"; // 'call' (10 min) o 'session' (60 min)
  const duration = type === "session" ? SESSION_DURATION_MINUTES : CALL_DURATION_MINUTES;

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return createJsonResponse({ status: "error", message: "Parámetro 'date' inválido (requerido YYYY-MM-DD)" });
  }

  const parts = dateStr.split("-");
  const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

  // 1. Validar fin de semana o feriado
  const dayOfWeek = targetDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6 || ARGENTINA_HOLIDAYS.indexOf(dateStr) !== -1) {
    return createJsonResponse({
      status: "success",
      date: dateStr,
      type: type,
      availableSlots: [],
      message: "Día no laborable (fin de semana o feriado)"
    });
  }

  // 2. Consultar Google Calendar
  const cal = getKinesicaCalendar();
  const dayStart = new Date(targetDate);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);

  const dayEnd = new Date(targetDate);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

  const events = cal.getEvents(dayStart, dayEnd);
  const busy = events.map(function(ev) {
    return {
      start: ev.getStartTime().getTime(),
      end: ev.getEndTime().getTime()
    };
  });

  // 3. Buffer para reservas del mismo día (mínimo 2 horas)
  const now = new Date();
  const isToday = (
    now.getFullYear() === targetDate.getFullYear() &&
    now.getMonth() === targetDate.getMonth() &&
    now.getDate() === targetDate.getDate()
  );
  const minAllowedTime = isToday ? (now.getTime() + SAME_DAY_BUFFER_HOURS * 3600 * 1000) : dayStart.getTime();

  // 4. Calcular slots libres
  const step = type === "call" ? 10 : 30; // pasos de evaluación
  const availableSlots = [];
  let current = new Date(dayStart);

  while (true) {
    const slotStart = current.getTime();
    const slotEnd = slotStart + duration * 60 * 1000;

    if (slotEnd > dayEnd.getTime()) break;

    if (slotStart >= minAllowedTime) {
      const hasCollision = busy.some(function(b) {
        return slotStart < b.end && slotEnd > b.start;
      });

      if (!hasCollision) {
        const h = ("0" + current.getHours()).slice(-2);
        const m = ("0" + current.getMinutes()).slice(-2);
        availableSlots.push({
          time: h + ":" + m,
          startIso: new Date(slotStart).toISOString(),
          endIso: new Date(slotEnd).toISOString()
        });
      }
    }

    current = new Date(current.getTime() + step * 60 * 1000);
  }

  return createJsonResponse({
    status: "success",
    date: dateStr,
    type: type,
    availableSlots: availableSlots
  });
}

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
 * Endpoint POST: Agenda el turno o llamada en Google Calendar.
 */
function handleBookAppointment(payload) {
  const tipo = payload.tipo || "primera_vez"; // 'primera_vez' | 'habitual'
  const appointmentType = payload.appointmentType || "call"; // 'call' | 'session'
  const nombre = (payload.nombre || "").trim();
  const telefono = String(payload.telefono || "").trim();
  const dni = (payload.dni || "No provisto").trim();
  const dateStr = payload.date; // YYYY-MM-DD
  const timeStr = payload.time; // HH:mm
  const motivo = (payload.motivo || "Consulta general").trim();
  const isMenor = Boolean(payload.isMenor);
  const nombreFamiliar = (payload.nombreFamiliar || "").trim();
  const notas = (payload.notas || "").trim();

  // =========================================================================
  // REGLA DE NEGOCIO KINÉSICA: PRIMERA VEZ REQUIERE LLAMADA PREVIA
  // =========================================================================
  if (tipo === "primera_vez" && appointmentType === "session") {
    return createJsonResponse({
      status: "error",
      message: "Para pacientes de primera vez es requisito coordinar una llamada de orientación de 10 minutos antes de agendar un turno presencial."
    }, 400);
  }

  if (!nombre || nombre.length < 3) {
    return createJsonResponse({ status: "error", message: "Nombre completo es requerido" }, 400);
  }

  if (!telefono || telefono.replace(/[^0-9]/g, "").length < 8) {
    return createJsonResponse({ status: "error", message: "Teléfono válido es requerido" }, 400);
  }

  const duration = appointmentType === "session" ? SESSION_DURATION_MINUTES : CALL_DURATION_MINUTES;
  const parts = dateStr.split("-");
  const timeParts = timeStr.split(":");

  const startTime = new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10),
    parseInt(timeParts[0], 10),
    parseInt(timeParts[1], 10),
    0
  );
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  // 1. Verificación atómica anti-colisión en Google Calendar
  const cal = getKinesicaCalendar();
  const existingEvents = cal.getEvents(startTime, endTime);
  if (existingEvents.length > 0) {
    return createJsonResponse({
      status: "conflict",
      message: "El horario seleccionado acaba de ser reservado por otro paciente. Por favor selecciona otro horario disponible."
    }, 409);
  }

  // 2. Construir título normalizado Kinésica
  let summary = "";
  if (appointmentType === "call") {
    summary = (isMenor && nombreFamiliar)
      ? "📞 [LLAMADA 10m - MENOR] " + nombre + " (Familiar: " + nombreFamiliar + ")"
      : "📞 [LLAMADA 10m] " + nombre;
  } else {
    summary = (isMenor && nombreFamiliar)
      ? "🩺 [TURNO - MENOR] " + nombre + " (Familiar: " + nombreFamiliar + ")"
      : "🩺 [TURNO] " + nombre;
  }

  // 3. Construir descripción normalizada
  const descParts = [
    "📱 WhatsApp: " + telefono,
    "🪪 DNI: " + dni,
    "🌿 Origen: Reserva Web Oficial Kinésica",
    "📋 Motivo: " + motivo
  ];
  if (isMenor && nombreFamiliar) descParts.push("👥 Adulto Responsable: " + nombreFamiliar);
  if (notas) descParts.push("💬 Notas: " + notas);
  const description = descParts.join(" | ");

  // 4. Crear evento en Google Calendar
  const event = cal.createEvent(summary, startTime, endTime, {
    description: description
  });

  // 5. Si es Primera Sesión Presencial, registrar en Google Sheets
  if (appointmentType === "session") {
    try {
      const sheet = getPatientsSheet();
      if (sheet) {
        const phoneFormatted = telefono.startsWith("'") ? telefono : "'" + telefono;
        const fechaHora = dateStr + " " + timeStr + " hs";
        sheet.appendRow([nombre, dni, phoneFormatted, fechaHora, motivo]);
      }
    } catch (e) {
      // No bloquea la respuesta si la planilla falla
    }
  }

  return createJsonResponse({
    status: "success",
    appointmentType: appointmentType,
    summary: summary,
    date: dateStr,
    time: timeStr,
    eventId: event.getId(),
    message: appointmentType === "call"
      ? "Tu llamada de orientación ha sido agendada con éxito."
      : "Tu turno presencial ha sido agendado con éxito."
  });
}

function createJsonResponse(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
