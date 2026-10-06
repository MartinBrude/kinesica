/**
 * Kinésica - Motor de Reservas y Reglas de Negocio
 * ==================================================
 * Implementa las reglas estrictas de agenda de Kinésica (Palermo, CABA):
 * 1. Solo turnos presenciales de 60 min. No hay llamadas de orientación.
 * 2. Cada técnica la atiende Norberto, María o ambos.
 * 3. Los horarios de cada profesional restringen los turnos ofrecidos.
 * 4. Feriados y fines de semana bloqueados.
 * 5. Un turno de un profesional no pisa otro turno de la misma persona.
 * 6. Buffer de traslado de 2 horas para turnos en el mismo día.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KinesicaBookingEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SESSION_DURATION_MINUTES = 60;
  const DAY_START_HOUR = 8;
  const DAY_END_HOUR = 19;
  const SESSION_BUFFER_HOURS = 2; // Turnos presenciales: mínimo 2 horas de margen de traslado
  const SAME_DAY_BUFFER_HOURS = 2;
  const SLOT_STEP_MINUTES = 30;

  const PRACTITIONERS = {
    norberto: { id: "norberto", name: "Norberto" },
    maria: { id: "maria", name: "María" },
  };

  const TECHNIQUES = [
    { id: "osteopatia", label: "Osteopatía", practitioners: ["norberto"] },
    { id: "acupuntura", label: "Acupuntura", practitioners: ["maria"] },
    { id: "rpg", label: "RPG", practitioners: ["norberto", "maria"] },
    { id: "neurodinamia", label: "Neurodinamia", practitioners: ["norberto", "maria"] },
    { id: "barral", label: "Barral", practitioners: ["norberto", "maria"] },
    { id: "posturologia", label: "Posturología", practitioners: ["maria"] },
    { id: "viscerales", label: "Manipulaciones viscerales", practitioners: ["norberto"] },
    { id: "no-se", label: "No sé", bySchedule: true, practitioners: ["norberto", "maria"] },
  ];

  // Horario semanal por profesional. Clave = día JS (0 domingo … 6 sábado).
  // null = todavía sin confirmar: se usa la franja general del consultorio (lun–vie 08:00–19:00).
  const PRACTITIONER_HOURS = {
    norberto: null,
    maria: null,
  };

  // Lista oficial de Feriados Nacionales de Argentina (YYYY-MM-DD)
  // Incluye inamovibles, trasladables y puentes turísticos oficiales
  const DEFAULT_ARGENTINA_HOLIDAYS = [
    // 2026
    "2026-01-01", // Año Nuevo
    "2026-02-16", // Carnaval
    "2026-02-17", // Carnaval
    "2026-03-24", // Memoria por la Verdad y la Justicia
    "2026-04-02", // Veteranos y Caídos en Malvinas
    "2026-04-03", // Viernes Santo
    "2026-05-01", // Día del Trabajador
    "2026-05-25", // Revolución de Mayo
    "2026-06-15", // Paso a la Inmortalidad de Güemes (trasladado)
    "2026-06-20", // Paso a la Inmortalidad de Belgrano
    "2026-07-09", // Día de la Independencia
    "2026-08-17", // Paso a la Inmortalidad de San Martín
    "2026-10-12", // Diversidad Cultural
    "2026-11-23", // Día de la Soberanía Nacional
    "2026-12-08", // Inmaculada Concepción
    "2026-12-25", // Navidad
    // 2027
    "2027-01-01",
    "2027-02-08",
    "2027-02-09",
    "2027-03-24",
    "2027-03-26",
    "2027-04-02",
    "2027-05-01",
    "2027-05-25",
    "2027-06-20",
    "2027-07-09",
    "2027-08-16",
    "2027-10-11",
    "2027-11-20",
    "2027-12-08",
    "2027-12-25",
  ];

  /**
   * Determina si una fecha (Date o string YYYY-MM-DD) es día hábil en Kinésica.
   */
  function isBusinessDay(dateInput, customHolidays) {
    const d = typeof dateInput === "string" ? parseLocalDate(dateInput) : new Date(dateInput);
    const dayOfWeek = d.getDay(); // 0 = Domingo, 6 = Sábado
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;

    const isoDate = formatDateIso(d);
    const holidays = customHolidays || DEFAULT_ARGENTINA_HOLIDAYS;
    if (holidays.includes(isoDate)) return false;

    return true;
  }

  function parseLocalDate(dateStr) {
    const parts = dateStr.split("-");
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  function formatDateIso(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getTechnique(techniqueId) {
    return TECHNIQUES.find(function (t) { return t.id === techniqueId; }) || null;
  }

  function practitionerOffersTechnique(practitionerId, techniqueId) {
    const technique = getTechnique(techniqueId);
    if (!technique || !PRACTITIONERS[practitionerId]) return false;
    if (technique.bySchedule) return true;
    return technique.practitioners.indexOf(practitionerId) !== -1;
  }

  function practitionersAt(dateInput, timeHm) {
    const timeMin = parseHmToMinutes(timeHm);
    return Object.keys(PRACTITIONERS).filter(function (id) {
      return getWorkingWindows(id, dateInput).some(function (w) {
        return timeMin >= w.startMin && timeMin + SESSION_DURATION_MINUTES <= w.endMin;
      });
    });
  }

  function parseHmToMinutes(hm) {
    const parts = String(hm || "").split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
  }

  /**
   * Ventanas de trabajo de un profesional en una fecha.
   * Si sus horarios aún no fueron cargados, usa lun–vie 08:00–19:00.
   */
  function getWorkingWindows(practitionerId, dateInput) {
    const d = typeof dateInput === "string" ? parseLocalDate(dateInput) : new Date(dateInput);
    const dow = d.getDay();
    const hours = PRACTITIONER_HOURS[practitionerId];
    if (!hours) {
      if (dow === 0 || dow === 6) return [];
      return [{ startMin: DAY_START_HOUR * 60, endMin: DAY_END_HOUR * 60 }];
    }
    const ranges = hours[dow] || [];
    return ranges.map(function (range) {
      return { startMin: parseHmToMinutes(range.start), endMin: parseHmToMinutes(range.end) };
    });
  }

  function eventBlocksPractitioner() {
    // Un solo consultorio: cualquier turno ocupa el horario para los dos.
    return true;
  }

  function formatTime(date) {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  /**
   * Calcula los intervalos ocupados a partir de eventos de Google Calendar.
   * Maneja tanto strings ISO como objetos Date.
   */
  function normalizeBusyIntervals(events) {
    if (!Array.isArray(events)) return [];
    return events.map(function (ev) {
      const start = new Date(ev.start || ev.startTime || ev);
      const end = new Date(ev.end || ev.endTime || ev);
      return { start: start.getTime(), end: end.getTime() };
    });
  }

  /**
   * Genera los slots disponibles para una fecha dada.
   * @param {Object} options
   * @param {string|Date} options.date - Fecha objetivo (YYYY-MM-DD o Date)
   * @param {string} [options.practitionerId] - 'norberto' | 'maria'
   * @param {Array} [options.busyIntervals] - Eventos ocupados [{start, end, practitioner?, title?}]
   * @param {Date} [options.now] - Fecha/hora actual para cálculo de buffer
   * @param {Array} [options.holidays] - Lista opcional de feriados
   * @returns {Array<{ time: string, startIso: string, endIso: string }>}
   */
  function calculateAvailableSlots(options) {
    const durationMinutes = SESSION_DURATION_MINUTES;
    const practitionerId = options.practitionerId || null;

    const baseDate =
      typeof options.date === "string" ? parseLocalDate(options.date) : new Date(options.date);

    if (!isBusinessDay(baseDate, options.holidays)) {
      return [];
    }

    const windows = practitionerId
      ? getWorkingWindows(practitionerId, baseDate)
      : [{ startMin: DAY_START_HOUR * 60, endMin: DAY_END_HOUR * 60 }];
    if (!windows.length) return [];

    const now = options.now ? new Date(options.now) : new Date();
    const rawBusy = Array.isArray(options.busyIntervals) ? options.busyIntervals : [];
    const relevantBusy = rawBusy.filter(function (ev) {
      return eventBlocksPractitioner(ev, practitionerId);
    });
    const busy = normalizeBusyIntervals(relevantBusy);

    const isToday = formatDateIso(baseDate) === formatDateIso(now);
    const minAllowedTime = isToday
      ? now.getTime() + SESSION_BUFFER_HOURS * 60 * 60 * 1000
      : 0;

    const slots = [];

    windows.forEach(function (windowRange) {
      let minute = windowRange.startMin;
      while (minute + durationMinutes <= windowRange.endMin) {
        const current = new Date(baseDate);
        current.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
        const slotStart = current.getTime();
        const slotEnd = slotStart + durationMinutes * 60 * 1000;

        if (slotStart >= minAllowedTime) {
          const overlaps = busy.some(function (b) {
            return slotStart < b.end && slotEnd > b.start;
          });
          if (!overlaps) {
            slots.push({
              time: formatTime(current),
              startIso: new Date(slotStart).toISOString(),
              endIso: new Date(slotEnd).toISOString(),
              durationMinutes: durationMinutes,
              practitionerId: practitionerId,
            });
          }
        }
        minute += SLOT_STEP_MINUTES;
      }
    });

    return slots;
  }

  /**
   * Valida una solicitud de reserva asegurando el cumplimiento de todas las reglas.
   * @param {Object} req
   * @param {string} req.techniqueId
   * @param {string} req.practitionerId - 'norberto' | 'maria'
   * @param {string} req.nombre - Nombre completo
   * @param {string} req.telefono - Teléfono / WhatsApp
   * @param {string} [req.dni] - DNI / Documento
   * @param {string} req.date - Fecha YYYY-MM-DD
   * @param {string} req.time - Hora HH:mm
   */
  function validateBookingRequest(req) {
    const errors = [];

    if (!req.nombre || req.nombre.trim().length < 3) {
      errors.push("El nombre y apellido completo es obligatorio (mínimo 3 caracteres).");
    }

    const cleanPhone = String(req.telefono || "").replace(/[^0-9]/g, "");
    if (!cleanPhone || cleanPhone.length < 8) {
      errors.push("El número de teléfono o WhatsApp ingresado no es válido.");
    }

    if (!req.date || !req.time) {
      errors.push("Debes seleccionar una fecha y horario.");
    } else {
      const parts = req.date.split("-");
      if (parts.length === 3) {
        const d = parseLocalDate(req.date);
        if (!isBusinessDay(d)) {
          errors.push("La fecha seleccionada no es un día hábil de atención (lunes a viernes).");
        }
      }
    }

    if (req.appointmentType === "call") {
      errors.push("Ya no se agendan llamadas. Elegí un turno presencial de 1 hora.");
    }

    const technique = getTechnique(req.techniqueId);
    if (!technique) {
      errors.push("Elegí la técnica de la sesión.");
    } else if (technique.bySchedule) {
      if (req.practitionerId && !PRACTITIONERS[req.practitionerId]) {
        errors.push("Elegí un horario de atención.");
      } else if (req.date && req.time && practitionersAt(req.date, req.time).length === 0) {
        errors.push("Ese horario está fuera del día de atención.");
      }
    } else if (!PRACTITIONERS[req.practitionerId] || !practitionerOffersTechnique(req.practitionerId, req.techniqueId)) {
      errors.push("Esa técnica no la atiende el profesional elegido.");
    }

    if (
      technique &&
      !technique.bySchedule &&
      req.date &&
      req.time &&
      req.practitionerId &&
      PRACTITIONERS[req.practitionerId]
    ) {
      const windows = getWorkingWindows(req.practitionerId, req.date);
      const timeMin = parseHmToMinutes(req.time);
      const fits = windows.some(function (w) {
        return timeMin >= w.startMin && timeMin + SESSION_DURATION_MINUTES <= w.endMin;
      });
      if (!fits) {
        errors.push("Ese horario está fuera del día de atención del profesional.");
      }
    }

    if (!req.dni || req.dni.trim().length < 5) {
      errors.push("Para turnos presenciales se requiere el número de DNI o documento.");
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * Genera el título normalizado para Google Calendar según el estándar de Kinésica.
   */
  function formatCalendarSummary(data) {
    const isMenor = Boolean(data.isMenor);
    const nombre = data.nombre.trim();
    const familiar = (data.nombreFamiliar || "").trim();

    const who = PRACTITIONERS[data.practitionerId];
    const whoTag = who ? `[${who.name.toUpperCase()}] ` : "";
    if (isMenor && familiar) {
      return `🩺 ${whoTag}[TURNO - MENOR] ${nombre} (Familiar: ${familiar})`;
    }
    return `🩺 ${whoTag}[TURNO] ${nombre}`;
  }

  /**
   * Genera la descripción normalizada para Google Calendar.
   */
  function formatCalendarDescription(data) {
    const technique = getTechnique(data.techniqueId);
    const who = PRACTITIONERS[data.practitionerId];
    const parts = [
      `📱 WhatsApp: ${data.telefono.trim()}`,
      `🪪 DNI: ${data.dni ? data.dni.trim() : "No provisto"}`,
      `🌿 Origen: Reserva Web Oficial Kinésica`,
    ];
    if (technique) parts.push(`🤲 Técnica: ${technique.label}`);
    if (who) parts.push(`👤 Profesional: ${who.name}`);
    if (data.motivo && data.motivo.trim()) {
      parts.push(`📋 Motivo: ${data.motivo.trim()}`);
    }
    if (data.isMenor && data.nombreFamiliar) {
      parts.push(`👥 Adulto Responsable: ${data.nombreFamiliar.trim()}`);
    }
    if (data.notas) {
      parts.push(`💬 Notas del paciente: ${data.notas.trim()}`);
    }
    return parts.join(" | ");
  }

  /**
   * Genera los datos para sincronización con calendarios personales del paciente
   * (Google Calendar e iCal/.ics para Apple Calendar y Outlook).
   */
  function generateCalendarExportData(payload, eventId) {
    const durationMinutes = SESSION_DURATION_MINUTES;

    const [year, month, day] = (payload.date || "").split("-").map(Number);
    const [hour, minute] = (payload.time || "").split(":").map(Number);

    // Horario local de Argentina: UTC-3
    const startUtc = new Date(Date.UTC(year, month - 1, day, hour + 3, minute));
    const endUtc = new Date(startUtc.getTime() + durationMinutes * 60 * 1000);

    const technique = getTechnique(payload.techniqueId);
    const who = PRACTITIONERS[payload.practitionerId];
    const title = technique
      ? `Turno en Kinésica — ${technique.label}`
      : "Turno en Kinésica";

    const location = "Charcas 3889, Piso 5º B, Palermo, CABA (entre Scalabrini Ortiz y Aráoz)";

    const description = [
      "Información importante:",
      "- Te pedimos que llegues a la hora de la sesión, ni antes ni después, por características del espacio y la organización.",
      "- Asistir sin acompañantes (salvo necesidad directa o menores).",
      "- Traer estudios médicos previos si contás con ellos.",
      technique ? `Técnica: ${technique.label}.` : "",
      who ? `Profesional: ${who.name}.` : "",
    ].filter(Boolean).join("\n");

    const toCompactUtc = (d) =>
      d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const startCompact = toCompactUtc(startUtc);
    const endCompact = toCompactUtc(endUtc);

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startCompact}/${endCompact}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;

    const escapeIcs = (str) =>
      (str || "")
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");

    const nowCompact = toCompactUtc(new Date());
    const uid = eventId || `kinesica-${Date.now()}@kinesica.com.ar`;

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Kinesica//Consultorio Kinesiologia//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${nowCompact}`,
      `DTSTART:${startCompact}`,
      `DTEND:${endCompact}`,
      `SUMMARY:${escapeIcs(title)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `LOCATION:${escapeIcs(location)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    return {
      title,
      location,
      description,
      startUtc,
      endUtc,
      startCompact,
      endCompact,
      googleCalendarUrl,
      icsContent,
      filename: `kinesica-turno-${payload.date}.ics`,
    };
  }

  return {
    SESSION_DURATION_MINUTES: SESSION_DURATION_MINUTES,
    DAY_START_HOUR: DAY_START_HOUR,
    DAY_END_HOUR: DAY_END_HOUR,
    SESSION_BUFFER_HOURS: SESSION_BUFFER_HOURS,
    SAME_DAY_BUFFER_HOURS: SAME_DAY_BUFFER_HOURS,
    PRACTITIONERS: PRACTITIONERS,
    TECHNIQUES: TECHNIQUES,
    PRACTITIONER_HOURS: PRACTITIONER_HOURS,
    DEFAULT_ARGENTINA_HOLIDAYS: DEFAULT_ARGENTINA_HOLIDAYS,
    isBusinessDay: isBusinessDay,
    getTechnique: getTechnique,
    practitionersAt: practitionersAt,
    getWorkingWindows: getWorkingWindows,
    practitionerOffersTechnique: practitionerOffersTechnique,
    calculateAvailableSlots: calculateAvailableSlots,
    validateBookingRequest: validateBookingRequest,
    formatCalendarSummary: formatCalendarSummary,
    formatCalendarDescription: formatCalendarDescription,
    generateCalendarExportData: generateCalendarExportData,
    formatDateIso: formatDateIso,
    parseLocalDate: parseLocalDate,
  };
});
