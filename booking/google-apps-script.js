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
 *    - WHATSAPP_TOKEN: Token de Meta WhatsApp Cloud API para enviar alertas por WhatsApp a Norberto.
 *    - NORBERTO_PHONE: "541161564311" (opcional, valor por defecto).
 *    - WHATSAPP_PHONE_NUMBER_ID: "1362220846964898" (opcional, valor por defecto).
 *    - N8N_ALERT_WEBHOOK_URL: (Opcional) URL de webhook n8n para despacho vía n8n.
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
const CALL_BUFFER_HOURS = 1; // Para llamadas de 10m: mínimo 1 hora de anticipación (no ofrecer nada en la siguiente hora)
const SESSION_BUFFER_HOURS = 2; // Para turnos presenciales de 1h: mínimo 2 horas de margen de traslado
const SAME_DAY_BUFFER_HOURS = 2; // Compatibilidad retroactiva
const MAX_BOOKING_DAYS = 60; // Máximo 60 días de anticipación para turnos

// Horarios semanales por profesional (0 domingo … 6 sábado)
const PRACTITIONER_HOURS = {
  norberto: {
    1: [{ start: "15:30", end: "19:00" }], // Lunes 15:30 a 19 hs
    2: [{ start: "15:00", end: "19:00" }], // Martes 15 a 19 hs
    3: [{ start: "09:00", end: "16:00" }], // Miércoles 9 a 16 hs
    4: [{ start: "15:00", end: "19:00" }], // Jueves 15 a 19 hs
    5: [{ start: "13:30", end: "19:00" }]  // Viernes 13:30 a 19 hs
  },
  maria: {
    1: [{ start: "09:00", end: "15:00" }], // Lunes 9 a 15 hs
    2: [{ start: "09:00", end: "14:30" }], // Martes 9 a 14:30 hs
    5: [{ start: "09:00", end: "13:00" }]  // Viernes 9 a 13 hs
  }
};

function getGasWorkingWindows(practitionerId, dayOfWeek) {
  if (dayOfWeek === 0 || dayOfWeek === 6) return [];
  if (practitionerId && PRACTITIONER_HOURS[practitionerId]) {
    return PRACTITIONER_HOURS[practitionerId][dayOfWeek] || [];
  }
  const combined = [];
  ["maria", "norberto"].forEach(function(pid) {
    const list = PRACTITIONER_HOURS[pid][dayOfWeek] || [];
    list.forEach(function(w) { combined.push(w); });
  });
  return combined;
}

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
    } else if (action === "get_slots_range") {
      return handleGetSlotsRange(params);
    } else if (action === "ping") {
      return createJsonResponse({
        status: "online",
        service: "Kinésica Calendar Booking API",
        version: "v2-timezone-fixed",
        calendarName: getKinesicaCalendar().getName()
      });
    } else if (action === "book") {
      return handleBookAppointment(params);
    } else if (action === "check_patient") {
      return handleCheckPatient(params);
    } else if (action === "get_directory") {
      return handleGetDirectory();
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
      return handleCheckPatient(payload);
    } else if (action === "book") {
      return handleBookAppointment(payload);
    } else if (action === "get_slots") {
      return handleGetSlots(payload);
    } else if (action === "get_slots_range") {
      return handleGetSlotsRange(payload);
    } else if (action === "ping") {
      return createJsonResponse({
        status: "online",
        service: "Kinésica Calendar Booking API",
        version: "v2-timezone-fixed",
        calendarName: getKinesicaCalendar().getName()
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

const ARG_OFFSET = "-03:00"; // Argentina (America/Argentina/Buenos_Aires) no tiene horario de verano, siempre es UTC-3

/**
 * Parsea una fecha y hora asegurando que se interprete estrictamente en la zona horaria de Argentina.
 */
function parseArgentinaDate(dateStr, timeStr) {
  const time = timeStr ? (timeStr.length === 5 ? timeStr + ":00" : timeStr) : "00:00:00";
  return new Date(dateStr + "T" + time + ARG_OFFSET);
}

/**
 * Endpoint GET: Devuelve los horarios libres para un día y tipo de turno.
 */
function handleGetSlots(params) {
  const dateStr = params.date; // YYYY-MM-DD
  const type = "session";
  const duration = SESSION_DURATION_MINUTES;

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return createJsonResponse({ status: "error", message: "Parámetro 'date' inválido (requerido YYYY-MM-DD)" });
  }

  // 1. Validar fin de semana o feriado nacional en Argentina
  const targetDate = parseArgentinaDate(dateStr, "12:00");
  const dayOfWeek = targetDate.getUTCDay(); // a las 12:00 Arg (15:00 UTC), el día UTC coincide con Argentina
  if (dayOfWeek === 0 || dayOfWeek === 6 || ARGENTINA_HOLIDAYS.indexOf(dateStr) !== -1) {
    return createJsonResponse({
      status: "success",
      date: dateStr,
      type: type,
      availableSlots: [],
      message: "Día no laborable (fin de semana o feriado)"
    });
  }

  const now = new Date();
  const todayInArg = Utilities.formatDate(now, "America/Argentina/Buenos_Aires", "yyyy-MM-dd");
  const todayMs = parseArgentinaDate(todayInArg, "00:00").getTime();
  const targetMs = parseArgentinaDate(dateStr, "00:00").getTime();
  const diffDays = Math.round((targetMs - todayMs) / (24 * 3600 * 1000));
  if (diffDays < 0 || diffDays > MAX_BOOKING_DAYS) {
    return createJsonResponse({
      status: "success",
      date: dateStr,
      type: type,
      availableSlots: [],
      message: "Fecha fuera del período permitido (máximo " + MAX_BOOKING_DAYS + " días)"
    });
  }

  const practitionerId = params.practitioner || params.practitionerId || "";
  const windows = getGasWorkingWindows(practitionerId, dayOfWeek);
  if (!windows.length) {
    return createJsonResponse({
      status: "success",
      date: dateStr,
      type: type,
      availableSlots: [],
      message: "Sin atención en este día"
    });
  }

  // 2. Consultar Google Calendar en el rango 08:00 a 19:00 hora de Argentina
  const cal = getKinesicaCalendar();
  const dayStart = parseArgentinaDate(dateStr, "08:00");
  const dayEnd = parseArgentinaDate(dateStr, "19:00");

  const events = cal.getEvents(dayStart, dayEnd);
  const busy = events.map(function(ev) {
    return {
      title: ev.getTitle(),
      startStr: Utilities.formatDate(ev.getStartTime(), "America/Argentina/Buenos_Aires", "HH:mm"),
      endStr: Utilities.formatDate(ev.getEndTime(), "America/Argentina/Buenos_Aires", "HH:mm"),
      start: ev.getStartTime().getTime(),
      end: ev.getEndTime().getTime()
    };
  });

  // 3. Buffer para reservas del mismo día:
  // - Turnos presenciales (60 min): mínimo 2 horas de margen de traslado
  const isToday = (todayInArg === dateStr);
  const bufferHours = SESSION_BUFFER_HOURS;
  const minAllowedTime = isToday ? (now.getTime() + bufferHours * 3600 * 1000) : dayStart.getTime();

  // 4. Calcular slots libres
  const step = 30;
  const availableSlots = [];

  windows.forEach(function(win) {
    const winStartParts = win.start.split(":").map(Number);
    const winEndParts = win.end.split(":").map(Number);
    const winStartMin = winStartParts[0] * 60 + winStartParts[1];
    const winEndMin = winEndParts[0] * 60 + winEndParts[1];

    for (let m = winStartMin; m + duration <= winEndMin; m += step) {
      const hh = ("0" + Math.floor(m / 60)).slice(-2);
      const mm = ("0" + (m % 60)).slice(-2);
      const timeSlotStr = hh + ":" + mm;

      const slotStart = parseArgentinaDate(dateStr, timeSlotStr).getTime();
      const slotEnd = slotStart + duration * 60 * 1000;

      if (slotStart >= minAllowedTime) {
        const hasCollision = busy.some(function(b) {
          return slotStart < b.end && slotEnd > b.start;
        });

        if (!hasCollision) {
          availableSlots.push({
            time: timeSlotStr,
            startIso: new Date(slotStart).toISOString(),
            endIso: new Date(slotEnd).toISOString()
          });
        }
      }
    }
  });

  return createJsonResponse({
    status: "success",
    version: "v2-timezone-fixed",
    date: dateStr,
    type: type,
    calendarName: cal.getName(),
    calendarId: cal.getId(),
    eventsDetected: busy.map(function(b) {
      return b.title + " (" + b.startStr + " a " + b.endStr + " hs)";
    }),
    availableSlots: availableSlots
  });
}

/**
 * Una sola lectura del calendario para varios días (from/to, YYYY-MM-DD).
 */
function handleGetSlotsRange(params) {
  const fromStr = params.from;
  const toStr = params.to;
  if (!fromStr || !toStr || !/^\d{4}-\d{2}-\d{2}$/.test(fromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
    return createJsonResponse({ status: "error", message: "Parámetros 'from' y 'to' inválidos (YYYY-MM-DD)" });
  }

  const fromMs = parseArgentinaDate(fromStr, "12:00").getTime();
  const toMs = parseArgentinaDate(toStr, "12:00").getTime();
  if (toMs < fromMs || (toMs - fromMs) > MAX_BOOKING_DAYS * 24 * 3600 * 1000) {
    return createJsonResponse({ status: "error", message: "Rango de fechas inválido (máximo " + MAX_BOOKING_DAYS + " días)" });
  }

  const cal = getKinesicaCalendar();
  const rangeStart = parseArgentinaDate(fromStr, "08:00");
  const rangeEnd = parseArgentinaDate(toStr, "19:00");
  const events = cal.getEvents(rangeStart, rangeEnd);
  const busy = events.map(function(ev) {
    return {
      start: ev.getStartTime().getTime(),
      end: ev.getEndTime().getTime()
    };
  });

  const now = new Date();
  const todayInArg = Utilities.formatDate(now, "America/Argentina/Buenos_Aires", "yyyy-MM-dd");
  const practitionerId = params.practitioner || params.practitionerId || "";
  const days = {};
  let cursor = fromStr;
  while (cursor <= toStr) {
    days[cursor] = computeDaySlots(cursor, busy, now, todayInArg, practitionerId);
    cursor = nextIsoDate(cursor);
  }

  return createJsonResponse({
    status: "success",
    version: "v3-slots-range",
    from: fromStr,
    to: toStr,
    days: days
  });
}

function nextIsoDate(dateStr) {
  const d = parseArgentinaDate(dateStr, "12:00");
  d.setUTCDate(d.getUTCDate() + 1);
  return Utilities.formatDate(d, "America/Argentina/Buenos_Aires", "yyyy-MM-dd");
}

function computeDaySlots(dateStr, busy, now, todayInArg, practitionerId) {
  const targetDate = parseArgentinaDate(dateStr, "12:00");
  const dayOfWeek = targetDate.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6 || ARGENTINA_HOLIDAYS.indexOf(dateStr) !== -1) {
    return [];
  }

  const todayMs = parseArgentinaDate(todayInArg, "00:00").getTime();
  const targetMs = parseArgentinaDate(dateStr, "00:00").getTime();
  const diffDays = Math.round((targetMs - todayMs) / (24 * 3600 * 1000));
  if (diffDays < 0 || diffDays > MAX_BOOKING_DAYS) {
    return [];
  }

  const windows = getGasWorkingWindows(practitionerId, dayOfWeek);
  if (!windows.length) return [];

  const dayStart = parseArgentinaDate(dateStr, "08:00");
  const isToday = todayInArg === dateStr;
  const minAllowedTime = isToday ? (now.getTime() + SESSION_BUFFER_HOURS * 3600 * 1000) : dayStart.getTime();
  const availableSlots = [];
  const duration = SESSION_DURATION_MINUTES;
  const step = 30;

  windows.forEach(function(win) {
    const winStartParts = win.start.split(":").map(Number);
    const winEndParts = win.end.split(":").map(Number);
    const winStartMin = winStartParts[0] * 60 + winStartParts[1];
    const winEndMin = winEndParts[0] * 60 + winEndParts[1];

    for (let m = winStartMin; m + duration <= winEndMin; m += step) {
      const timeSlotStr = ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + (m % 60)).slice(-2);
      const slotStart = parseArgentinaDate(dateStr, timeSlotStr).getTime();
      const slotEnd = slotStart + duration * 60 * 1000;
      if (slotStart < minAllowedTime) continue;
      const hasCollision = busy.some(function(b) {
        return slotStart < b.end && slotEnd > b.start;
      });
      if (!hasCollision) {
        availableSlots.push({
          time: timeSlotStr,
          startIso: new Date(slotStart).toISOString(),
          endIso: new Date(slotEnd).toISOString()
        });
      }
    }
  });

  return availableSlots;
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
 * Endpoint GET: Devuelve el directorio de pacientes registrado en Google Sheets
 * en formato { "nombre normalizado": "telefono" } para resolución automática de recordatorios.
 */
function handleGetDirectory() {
  const sheet = getPatientsSheet();
  if (!sheet) {
    return createJsonResponse({ status: "success", action: "get_directory", total: 0, directory: {} });
  }

  const data = sheet.getDataRange().getValues();
  const directory = {};
  for (let i = 1; i < data.length; i++) {
    const rawName = String(data[i][0] || "").trim();
    const cleanName = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const rawPhone = String(data[i][2] || "").replace(/[^0-9]/g, '');
    if (cleanName && rawPhone && rawPhone.length >= 8) {
      let phone = rawPhone;
      if (phone.startsWith('549') && phone.length >= 12) phone = phone.substring(0, 13);
      else if (phone.startsWith('54') && !phone.startsWith('549') && phone.length >= 12) phone = '549' + phone.slice(2, 12);
      else if (phone.startsWith('11') && phone.length === 10) phone = '549' + phone;
      directory[cleanName] = phone;
    }
  }

  return createJsonResponse({
    status: "success",
    action: "get_directory",
    total: Object.keys(directory).length,
    directory: directory
  });
}

/**
 * Endpoint POST: Agenda el turno o llamada en Google Calendar.
 */
function handleBookAppointment(payload) {
  const tipo = payload.tipo || "primera_vez"; // 'primera_vez' | 'habitual'
  const appointmentType = payload.appointmentType || "session";
  const nombre = (payload.nombre || "").trim();
  const telefono = String(payload.telefono || "").trim();
  const email = (payload.email || "").trim();
  const dni = (payload.dni || "No provisto").trim();
  const dateStr = payload.date; // YYYY-MM-DD
  const timeStr = payload.time; // HH:mm
  const isMenor = Boolean(payload.isMenor);
  const nombreFamiliar = (payload.nombreFamiliar || "").trim();
  const notas = (payload.notas || "").trim();

  if (appointmentType === "call") {
    return createJsonResponse({
      status: "error",
      message: "Ya no se agendan llamadas. Elegí un turno presencial de 1 hora."
    }, 400);
  }

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !timeStr) {
    return createJsonResponse({ status: "error", message: "Fecha (YYYY-MM-DD) y hora (HH:mm) son requeridas para la reserva." }, 400);
  }

  if (!nombre || nombre.length < 3) {
    return createJsonResponse({ status: "error", message: "Nombre completo es requerido" }, 400);
  }

  if (!telefono || telefono.replace(/[^0-9]/g, "").length < 8) {
    return createJsonResponse({ status: "error", message: "Teléfono válido es requerido" }, 400);
  }

  const duration = SESSION_DURATION_MINUTES;
  const startTime = parseArgentinaDate(dateStr, timeStr);
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  // 1. Verificación de anticipación mínima y máximo 60 días
  const now = new Date();
  const todayInArg = Utilities.formatDate(now, "America/Argentina/Buenos_Aires", "yyyy-MM-dd");
  const isToday = (todayInArg === dateStr);
  const todayMs = parseArgentinaDate(todayInArg, "00:00").getTime();
  const targetMs = parseArgentinaDate(dateStr, "00:00").getTime();
  const diffDays = Math.round((targetMs - todayMs) / (24 * 3600 * 1000));
  if (diffDays < 0) {
    return createJsonResponse({ status: "error", message: "No se pueden agendar turnos en fechas pasadas." }, 400);
  }
  if (diffDays > MAX_BOOKING_DAYS) {
    return createJsonResponse({ status: "error", message: "Los turnos se pueden solicitar a un máximo de " + MAX_BOOKING_DAYS + " días." }, 400);
  }

  const bufferHours = SESSION_BUFFER_HOURS;
  const minAllowedTime = isToday ? (now.getTime() + bufferHours * 3600 * 1000) : parseArgentinaDate(dateStr, "08:00").getTime();
  if (startTime.getTime() < minAllowedTime) {
    return createJsonResponse({
      status: "error",
      message: "Los turnos presenciales deben reservarse con al menos 2 horas de anticipación."
    }, 400);
  }

  // 2. Verificación de horario del profesional
  const targetDate = parseArgentinaDate(dateStr, "12:00");
  const dayOfWeek = targetDate.getUTCDay();
  const practitionerId = payload.practitionerId || "";
  const windows = getGasWorkingWindows(practitionerId, dayOfWeek);
  const timeParts = timeStr.split(":").map(Number);
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

  // 2. Verificación atómica anti-colisión en Google Calendar
  const cal = getKinesicaCalendar();
  const existingEvents = cal.getEvents(startTime, endTime);
  if (existingEvents.length > 0) {
    return createJsonResponse({
      status: "conflict",
      message: "El horario seleccionado acaba de ser reservado por otro paciente. Por favor selecciona otro horario disponible."
    }, 409);
  }

  // 3. Construir título normalizado Kinésica
  const practitionerNames = { norberto: "Norberto", maria: "María" };
  const whoName = practitionerNames[practitionerId] || "";
  const whoTag = whoName ? "[" + whoName.toUpperCase() + "] " : "";
  const summary = (isMenor && nombreFamiliar)
    ? "🩺 " + whoTag + "[TURNO - MENOR] " + nombre + " (Familiar: " + nombreFamiliar + ")"
    : "🩺 " + whoTag + "[TURNO] " + nombre;

  const techniqueLabels = {
    osteopatia: "Osteopatía",
    acupuntura: "Acupuntura",
    rpg: "RPG",
    neurodinamia: "Neurodinamia",
    viscerales: "Manipulaciones viscerales (Barral)",
    posturologia: "Posturología",
    "no-se": "No especifica"
  };
  const techniqueId = String(payload.techniqueId || "");
  const techniqueLabel = techniqueLabels[techniqueId] || "";

  const especialidad = techniqueId === "no-se"
    ? "No especifica"
    : (techniqueLabel || payload.especialidad || (payload.motivo && payload.motivo !== "Consulta general" ? payload.motivo : "") || "No especifica");

  const motivo = especialidad;

  // 3. Construir descripción normalizada
  const descParts = [];
  if (whoName) descParts.push("👤 Profesional: " + whoName);
  descParts.push(
    "📱 WhatsApp: " + telefono,
    (email ? "📧 Email: " + email : null),
    "🪪 DNI: " + dni,
    "🌿 Origen: Reserva Web Oficial Kinésica",
    "📋 Especialidad: " + especialidad
  );
  if (isMenor && nombreFamiliar) descParts.push("👥 Adulto Responsable: " + nombreFamiliar);
  if (notas) descParts.push("💬 Notas: " + notas);
  const description = descParts.filter(Boolean).join(" | ");

  // 4. Crear evento en Google Calendar
  const practitionerContact = resolvePractitionerContact(practitionerId);
  const event = cal.createEvent(summary, startTime, endTime, {
    description: description
  });
  if (practitionerId && practitionerContact.email) {
    try {
      event.addGuest(practitionerContact.email);
    } catch (guestErr) {
      console.error("No se pudo invitar a " + practitionerContact.email + ": " + guestErr);
    }
  }

  // 5. Si es Primera Sesión Presencial, registrar en Google Sheets
  if (appointmentType === "session") {
    try {
      const sheet = getPatientsSheet();
      if (sheet) {
        const phoneFormatted = telefono.startsWith("'") ? telefono : "'" + telefono;
        const fechaHora = dateStr + " " + timeStr + " hs";
        sheet.appendRow([nombre, dni, phoneFormatted, fechaHora, motivo, techniqueLabel]);
      }
    } catch (e) {
      // No bloquea la respuesta si la planilla falla
    }
  }

  // 6. Avisar por WhatsApp (y mail de respaldo) al profesional del turno.
  // Si puede atender cualquiera de los dos, avisar a ambos.
  try {
    const notifyIds = practitionerId ? [practitionerId] : ["norberto", "maria"];
    notifyIds.forEach(function (id) {
      notifyPractitionerNewWebBooking(id, {
        appointmentType: appointmentType,
        nombre: nombre,
        telefono: telefono,
        dni: dni,
        date: dateStr,
        time: timeStr,
        especialidad: especialidad,
        motivo: especialidad,
        isMenor: isMenor,
        nombreFamiliar: nombreFamiliar,
        notas: notas,
        summary: summary,
        practitionerName: whoName,
        technique: techniqueLabel
      });
    });
  } catch (errNotify) {
    console.error("Error al notificar al profesional: " + errNotify);
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

/**
 * Teléfono y mail del profesional que atiende el turno.
 * María se configura en las propiedades del script: MARIA_PHONE y MARIA_EMAIL.
 */
function resolvePractitionerContact(practitionerId) {
  const props = PropertiesService.getScriptProperties();
  if (practitionerId === "maria") {
    return {
      id: "maria",
      name: "María",
      phone: props.getProperty("MARIA_PHONE") || "541128531224",
      email: props.getProperty("MARIA_EMAIL") || "manosmagicas7116@gmail.com"
    };
  }
  return {
    id: "norberto",
    name: "Norberto",
    phone: props.getProperty("NORBERTO_PHONE") || "541161564311",
    email: props.getProperty("NORBERTO_EMAIL") || "norberto1712@gmail.com"
  };
}

/**
 * Avisa al profesional del turno por WhatsApp y, si no sale, por mail.
 */
function notifyPractitionerNewWebBooking(practitionerId, data) {
  const contact = resolvePractitionerContact(practitionerId);
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("WHATSAPP_TOKEN") || props.getProperty("META_ACCESS_TOKEN");
  const phoneId = props.getProperty("WHATSAPP_PHONE_NUMBER_ID") || "1362220846964898";
  const n8nWebhookUrl = props.getProperty("N8N_ALERT_WEBHOOK_URL");

  const tipoDetalle = data.appointmentType === "session"
    ? "🩺 Turno presencial en consultorio (60 min)"
    : "📞 Llamada de orientación previa (10 min)";

  const cleanPhone = String(data.telefono || "").replace(/[^0-9]/g, "");
  const waLink = cleanPhone ? ("wa.me/" + cleanPhone) : "No provisto";
  const fechaAmigable = formatFriendlyDate(data.date);

  let message = "📌 *NUEVA RESERVA PARA " + contact.name.toUpperCase() + "*\n" +
    "• *Profesional:* " + contact.name + "\n" +
    "• *Tipo:* " + tipoDetalle + "\n" +
    "• *Paciente:* " + data.nombre + "\n" +
    "• *Fecha y Hora:* " + fechaAmigable + " a las " + data.time + " hs\n" +
    "• *WhatsApp:* " + waLink + "\n" +
    "• *DNI:* " + (data.dni || "No provisto") + "\n" +
    "• *Especialidad:* " + (data.especialidad || data.technique || data.motivo || "No especifica");

  if (data.isMenor && data.nombreFamiliar) {
    message += "\n• *Adulto Responsable (Menor):* " + data.nombreFamiliar;
  }
  if (data.notas) {
    message += "\n• *Notas del paciente:* " + data.notas;
  }
  message += "\n\n*(Agendado automáticamente a través de kinesica.com.ar/turnos.html)*";

  let sent = false;

  // 1. Envío directo mediante Meta WhatsApp Cloud API (Graph v21.0)
  if (token && contact.phone) {
    try {
      const url = "https://graph.facebook.com/v21.0/" + phoneId + "/messages";
      const res = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        headers: {
          "Authorization": "Bearer " + token
        },
        payload: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: contact.phone,
          type: "text",
          text: { body: message }
        }),
        muteHttpExceptions: true,
        deadline: 8
      });
      const code = res.getResponseCode();
      if (code >= 200 && code < 300) {
        sent = true;
      } else {
        console.warn("Meta WhatsApp Cloud API devolvió código " + code + ": " + res.getContentText());
      }
    } catch (e) {
      console.error("Excepción al despachar WhatsApp a " + contact.name + ": " + e.toString());
    }
  }

  // 2. Envío secundario mediante Webhook n8n (si está configurado N8N_ALERT_WEBHOOK_URL)
  if (!sent && n8nWebhookUrl) {
    try {
      const res = UrlFetchApp.fetch(n8nWebhookUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          action: "web_booking_alert",
          to: contact.phone,
          body: message,
          booking: data
        }),
        muteHttpExceptions: true,
        deadline: 8
      });
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
        sent = true;
      }
    } catch (e) {
      console.error("Excepción al despachar webhook de n8n: " + e.toString());
    }
  }

  // 3. Resguardo por Correo Electrónico (Zero-Ghosting garantizado si WhatsApp no estuviese disponible)
  if (!sent) {
    try {
      if (!contact.email) {
        console.error("Sin mail de respaldo para " + contact.name + ". Configurá MARIA_EMAIL o NORBERTO_EMAIL.");
      } else {
      const cleanSubject = "📌 [KINÉSICA] Reserva para " + contact.name + ": " + data.nombre + " - " + fechaAmigable + " " + data.time + " hs";
      const plainBody = message.replace(/\*([^*]+)\*/g, "$1");
      MailApp.sendEmail({
        to: contact.email,
        subject: cleanSubject,
        body: plainBody
      });
      }
    } catch (e) {
      console.error("Excepción en MailApp fallback: " + e.toString());
    }
  }

  return sent;
}

/**
 * Formatea una fecha YYYY-MM-DD en texto legible en español (ej: "Jueves 08/10")
 */
function formatFriendlyDate(dateStr) {
  try {
    const parts = dateStr.split("-");
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return dias[d.getDay()] + " " + parts[2] + "/" + parts[1];
  } catch (e) {
    return dateStr;
  }
}

function createJsonResponse(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Función de prueba para verificar el envío desde el editor de Google Apps Script:
 * 1. Seleccioná "testNotifyNorberto" en el menú desplegable superior.
 * 2. Hacé clic en "Ejecutar".
 * 3. En el Registro de ejecución verás si el WhatsApp llegó con éxito o el error exacto de Meta.
 */
function testNotifyNorberto() {
  const result = notifyPractitionerNewWebBooking("norberto", {
    appointmentType: "call",
    nombre: "Paciente de Prueba",
    telefono: "5491161564311",
    dni: "12345678",
    date: "2026-10-15",
    time: "10:00",
    motivo: "Prueba de notificación WhatsApp Norberto",
    isMenor: false,
    nombreFamiliar: "",
    notas: "Mensaje de prueba generado desde el editor de Apps Script"
  });
  console.log("Resultado del test: " + (result ? "✅ ENVIADO POR WHATSAPP EXITOSAMENTE" : "⚠️ NO SE PUDO ENVIAR POR WHATSAPP (Se activó el email de contingencia)"));
}
