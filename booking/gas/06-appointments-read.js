/**
 * Kinésica GAS — Lectura de turnos: list_appointments, check_events y get_directory.
 * Archivo parte del proyecto Apps Script (ámbito global compartido). Ver 00-config.js.
 */

/**
 * Lista turnos reales del calendario consultorio en un rango de fechas (YYYY-MM-DD).
 * Requiere secret == GAS_API_SECRET.
 */
function handleListAppointments(params) {
  const dateFrom = String((params && params.dateFrom) || (params && params.from) || "").trim();
  const dateTo = String((params && params.dateTo) || (params && params.to) || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return createJsonResponse({
      status: "error",
      message: "Parámetros dateFrom/dateTo inválidos (requerido YYYY-MM-DD)"
    }, 400);
  }
  if (dateFrom > dateTo) {
    return createJsonResponse({
      status: "error",
      message: "dateFrom no puede ser posterior a dateTo"
    }, 400);
  }

  const rangeStart = parseArgentinaDate(dateFrom, "00:00");
  const rangeEnd = parseArgentinaDate(dateTo, "23:59:59");

  const cal = getKinesicaCalendar();
  const events = cal.getEvents(rangeStart, rangeEnd);
  const appointments = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const title = String(ev.getTitle() || "").trim();
    if (isNonPatientAppointmentTitle(title)) continue;

    const patientName = parseAppointmentPatientName(title);
    if (!patientName || isNonPatientAppointmentTitle(patientName)) continue;

    const start = ev.getStartTime();
    const date = Utilities.formatDate(start, "America/Argentina/Buenos_Aires", "yyyy-MM-dd");
    if (date < dateFrom || date > dateTo) continue;

    let description = "";
    try {
      description = String(ev.getDescription() || "");
    } catch (e) {
      description = "";
    }

    let eventId = "";
    try {
      eventId = String(ev.getId() || "");
    } catch (e2) {
      eventId = "";
    }

    const contacts = extractContactsFromAppointment(title, description);
    appointments.push({
      eventId: eventId,
      title: title,
      patientName: patientName,
      date: date,
      startIso: start.toISOString ? start.toISOString() : String(start),
      description: description,
      phone: contacts.phone,
      dni: contacts.dni
    });
  }

  appointments.sort(function (a, b) {
    if (a.date === b.date) return String(a.patientName).localeCompare(String(b.patientName));
    return a.date < b.date ? -1 : 1;
  });

  return createJsonResponse({
    status: "success",
    action: "list_appointments",
    dateFrom: dateFrom,
    dateTo: dateTo,
    total: appointments.length,
    appointments: appointments
  });
}

/**
 * Verifica existencia/cancelación de eventos por ID (recordatorios: TC-50 pre-send).
 * Body: { calendar_event_ids: ["…"] } o { eventIds: ["…"] }
 * → { events: { "<id>": { exists, cancelled, title } } }
 */
function handleCheckEvents(params) {
  let ids = params && (params.calendar_event_ids || params.eventIds || params.event_ids);
  if (typeof ids === "string") {
    try {
      ids = JSON.parse(ids);
    } catch (e) {
      ids = String(ids).split(",").map(function (s) { return s.trim(); });
    }
  }
  if (!Array.isArray(ids)) ids = [];
  const uniq = [];
  const seen = {};
  for (let i = 0; i < ids.length && uniq.length < 100; i++) {
    const id = String(ids[i] || "").trim();
    if (!id || seen[id]) continue;
    seen[id] = true;
    uniq.push(id);
  }

  const cal = getKinesicaCalendar();
  const events = {};
  for (let j = 0; j < uniq.length; j++) {
    const eventId = uniq[j];
    let event = null;
    try {
      event = cal.getEventById(eventId);
    } catch (errFind) {
      event = null;
    }
    if (!event) {
      events[eventId] = { exists: false, cancelled: false, title: "" };
      continue;
    }
    let title = "";
    let description = "";
    try {
      title = String(event.getTitle() || "");
    } catch (eTitle) {
      title = "";
    }
    try {
      description = String(event.getDescription() || "");
    } catch (eDesc) {
      description = "";
    }
    const cancelled = isCancelledAppointmentText(title + " " + description)
      || isNonPatientAppointmentTitle(title);
    events[eventId] = {
      exists: true,
      cancelled: Boolean(cancelled),
      title: title
    };
  }

  return createJsonResponse({
    status: "success",
    action: "check_events",
    total: uniq.length,
    events: events
  });
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
