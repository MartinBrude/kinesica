/**
 * Kinésica GAS — Cálculo de horarios disponibles (get_slots / get_slots_range).
 * Archivo parte del proyecto Apps Script (ámbito global compartido). Ver 00-config.js.
 */

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
  const windows = getGasWorkingWindows(practitionerId, dayOfWeek, params.hours, { date: dateStr, overrides: params.overrides || params.schedule_overrides });
  if (!windows.length) {
    return createJsonResponse({
      status: "success",
      date: dateStr,
      type: type,
      availableSlots: [],
      message: "Sin atención en este día"
    });
  }

  // 2. Consultar Google Calendar en el rango 08:00 a 20:00 hora de Argentina
  const cal = getKinesicaCalendar();
  const dayStart = parseArgentinaDate(dateStr, "08:00");
  const dayEnd = parseArgentinaDate(dateStr, "20:00");

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
    // Privacidad: el endpoint es público; no se exponen eventos (nombres de pacientes) ni el id del calendario.
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
  const rangeEnd = parseArgentinaDate(toStr, "20:00");
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
  const customHoursRaw = params.hours || null;
  const overrides = extractGasOverrides(null, params, customHoursRaw);
  const days = {};
  let cursor = fromStr;
  while (cursor <= toStr) {
    days[cursor] = computeDaySlots(cursor, busy, now, todayInArg, practitionerId, customHoursRaw, overrides);
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

function computeDaySlots(dateStr, busy, now, todayInArg, practitionerId, customHoursRaw, overrides) {
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

  const windows = getGasWorkingWindows(practitionerId, dayOfWeek, customHoursRaw, { date: dateStr, overrides: overrides });
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
