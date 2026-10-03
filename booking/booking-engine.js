/**
 * Kinésica - Motor de Reservas y Reglas de Negocio
 * ==================================================
 * Implementa las reglas estrictas de agenda de Kinésica (Palermo, CABA):
 * 1. Primera Vez: Requiere OBLIGATORIAMENTE llamada previa de orientación de 10 min.
 * 2. Paciente Habitual: Habilitado para Turno Presencial de 60 min o llamada de 10 min.
 * 3. Franja horaria: Lunes a viernes de 08:00 a 19:00 hs (America/Argentina/Buenos_Aires).
 * 4. Feriados y fines de semana bloqueados.
 * 5. Anti-colisión estricta (unicidad del profesional): una llamada no colisiona con un turno.
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

  const CALL_DURATION_MINUTES = 10;
  const SESSION_DURATION_MINUTES = 60;
  const DAY_START_HOUR = 8;
  const DAY_END_HOUR = 19;
  const SAME_DAY_BUFFER_HOURS = 2;

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
   * @param {string} options.appointmentType - 'call' (10 min) o 'session' (60 min)
   * @param {Array} [options.busyIntervals] - Eventos ocupados [{start, end}]
   * @param {Date} [options.now] - Fecha/hora actual para cálculo de buffer
   * @param {Array} [options.holidays] - Lista opcional de feriados
   * @returns {Array<{ time: string, startIso: string, endIso: string }>}
   */
  function calculateAvailableSlots(options) {
    const appointmentType = options.appointmentType || "call";
    const durationMinutes =
      appointmentType === "session" ? SESSION_DURATION_MINUTES : CALL_DURATION_MINUTES;

    const baseDate =
      typeof options.date === "string" ? parseLocalDate(options.date) : new Date(options.date);

    if (!isBusinessDay(baseDate, options.holidays)) {
      return [];
    }

    const now = options.now ? new Date(options.now) : new Date();
    const busy = normalizeBusyIntervals(options.busyIntervals);

    // Inicio y fin de la franja (08:00 a 19:00 hs)
    const windowStart = new Date(baseDate);
    windowStart.setHours(DAY_START_HOUR, 0, 0, 0);

    const windowEnd = new Date(baseDate);
    windowEnd.setHours(DAY_END_HOUR, 0, 0, 0);

    // Buffer de 2 horas si es para el mismo día
    const isToday = formatDateIso(baseDate) === formatDateIso(now);
    const minAllowedTime = isToday
      ? now.getTime() + SAME_DAY_BUFFER_HOURS * 60 * 60 * 1000
      : windowStart.getTime();

    const slots = [];
    const stepMinutes = appointmentType === "call" ? 10 : 30; // saltos de 10 min o 30 min para ofrecer turnos

    let current = new Date(windowStart);
    while (true) {
      const slotStart = current.getTime();
      const slotEnd = slotStart + durationMinutes * 60 * 1000;

      // No exceder las 19:00 hs
      if (slotEnd > windowEnd.getTime()) {
        break;
      }

      // Debe cumplir el buffer si es hoy
      if (slotStart >= minAllowedTime) {
        // Verificar no-solapamiento con eventos existentes
        const overlaps = busy.some(function (b) {
          return slotStart < b.end && slotEnd > b.start;
        });

        if (!overlaps) {
          slots.push({
            time: formatTime(current),
            startIso: new Date(slotStart).toISOString(),
            endIso: new Date(slotEnd).toISOString(),
            durationMinutes: durationMinutes,
          });
        }
      }

      current = new Date(current.getTime() + stepMinutes * 60 * 1000);
    }

    return slots;
  }

  /**
   * Valida una solicitud de reserva asegurando el cumplimiento de todas las reglas.
   * @param {Object} req
   * @param {string} req.tipo - 'primera_vez' | 'habitual'
   * @param {string} req.appointmentType - 'call' | 'session'
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

    // =========================================================================
    // REGLA CRÍTICA DE PRIMERA VEZ (KINESICA-BOT):
    // Si es primera vez, REQUIERE OBLIGATORIAMENTE llamada de 10 min previa.
    // No se permite agendar turno presencial directo sin la llamada inicial.
    // =========================================================================
    if (req.tipo === "primera_vez" && req.appointmentType === "session") {
      errors.push(
        "Para tu primera atención en Kinésica es requisito realizar antes una llamada previa de orientación sin cargo de 10 minutos con el profesional para evaluar tu caso e informarte los honorarios."
      );
    }

    // Para turnos presenciales de habituales, requerir DNI si está disponible
    if (req.appointmentType === "session" && (!req.dni || req.dni.trim().length < 5)) {
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

    if (data.appointmentType === "call") {
      if (isMenor && familiar) {
        return `📞 [LLAMADA 10m - MENOR] ${nombre} (Familiar: ${familiar})`;
      }
      return `📞 [LLAMADA 10m] ${nombre}`;
    } else {
      if (isMenor && familiar) {
        return `🩺 [TURNO - MENOR] ${nombre} (Familiar: ${familiar})`;
      }
      return `🩺 [TURNO] ${nombre}`;
    }
  }

  /**
   * Genera la descripción normalizada para Google Calendar.
   */
  function formatCalendarDescription(data) {
    const parts = [
      `📱 WhatsApp: ${data.telefono.trim()}`,
      `🪪 DNI: ${data.dni ? data.dni.trim() : "No provisto"}`,
      `🌿 Origen: Reserva Web Oficial Kinésica`,
    ];
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

  return {
    CALL_DURATION_MINUTES: CALL_DURATION_MINUTES,
    SESSION_DURATION_MINUTES: SESSION_DURATION_MINUTES,
    DAY_START_HOUR: DAY_START_HOUR,
    DAY_END_HOUR: DAY_END_HOUR,
    DEFAULT_ARGENTINA_HOLIDAYS: DEFAULT_ARGENTINA_HOLIDAYS,
    isBusinessDay: isBusinessDay,
    calculateAvailableSlots: calculateAvailableSlots,
    validateBookingRequest: validateBookingRequest,
    formatCalendarSummary: formatCalendarSummary,
    formatCalendarDescription: formatCalendarDescription,
    formatDateIso: formatDateIso,
    parseLocalDate: parseLocalDate,
  };
});
