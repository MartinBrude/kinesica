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
  const DAY_END_HOUR = 20;
  const SESSION_BUFFER_HOURS = 2; // Turnos presenciales: mínimo 2 horas de margen de traslado
  const SAME_DAY_BUFFER_HOURS = 2;
  const SLOT_STEP_MINUTES = 30;

  const PRACTITIONERS = {
    norberto: { id: "norberto", name: "Norberto", whatsapp: "5491161564311" },
    maria: { id: "maria", name: "María", whatsapp: "5491128531224" },
  };

  const TECHNIQUES = [
    { id: "osteopatia", label: "Osteopatía", practitioners: ["norberto"] },
    { id: "acupuntura", label: "Acupuntura", practitioners: ["maria"] },
    { id: "rpg", label: "RPG", practitioners: ["norberto", "maria"] },
    { id: "neurodinamia", label: "Neurodinamia", practitioners: ["norberto", "maria"] },
    { id: "viscerales", label: "Manipulaciones viscerales (Barral)", practitioners: ["norberto", "maria"] },
    { id: "posturologia", label: "Posturología", practitioners: ["maria"] },
    { id: "no-se", label: "No sé", bySchedule: true, practitioners: ["norberto", "maria"] },
    { id: "paciente", label: "Paciente en tratamiento", internal: true, practitioners: ["norberto", "maria"] },
  ];

  const MAX_BOOKING_DAYS = 60;

  // Horario semanal por defecto por profesional. Clave = día JS (0 domingo … 6 sábado).
  // María: Lunes 9 a 17, Martes 9 a 16, Viernes 9 a 13.
  // Norberto: Lunes 17:30 a 19:30, Martes 16:30 a 19:30, Miércoles 9 a 16:30, Jueves 15 a 19, Viernes 13:30 a 19:30.
  const DEFAULT_PRACTITIONER_HOURS = {
    norberto: {
      1: [{ start: "17:30", end: "19:30" }], // Lunes 17:30 a 19:30 hs
      2: [{ start: "16:30", end: "19:30" }], // Martes 16:30 a 19:30 hs
      3: [{ start: "09:00", end: "16:30" }], // Miércoles 9 a 16:30 hs
      4: [{ start: "15:00", end: "19:00" }], // Jueves 15 a 19 hs
      5: [{ start: "13:30", end: "19:30" }], // Viernes 13:30 a 19:30 hs
    },
    maria: {
      1: [{ start: "09:00", end: "17:00" }], // Lunes 9 a 17 hs
      2: [{ start: "09:00", end: "16:00" }], // Martes 9 a 16 hs
      5: [{ start: "09:00", end: "13:00" }], // Viernes 9 a 13 hs
    },
  };

  function clonePractitionerHours(source) {
    const src = source || DEFAULT_PRACTITIONER_HOURS;
    const out = { norberto: {}, maria: {} };
    ["norberto", "maria"].forEach(function (pid) {
      const pDays = (src && src[pid]) || {};
      Object.keys(pDays).forEach(function (dow) {
        const list = pDays[dow];
        if (Array.isArray(list) && list.length > 0) {
          out[pid][dow] = list.map(function (r) {
            return { start: String(r.start || ""), end: String(r.end || "") };
          });
        }
      });
    });
    return out;
  }

  const PRACTITIONER_HOURS = clonePractitionerHours(DEFAULT_PRACTITIONER_HOURS);

  const DAY_NAMES_ES = {
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
  };

  function minutesToHm(totalMin) {
    const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
    const m = String(totalMin % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  function isValidTimeFormat(hm) {
    return typeof hm === "string" && /^([01]\d|2[0-3]):(00|30)$/.test(hm.trim());
  }

  /**
   * Valida la estructura completa de horarios de los profesionales:
   * - Hasta 2 franjas por día (Lunes a Viernes, claves 1..5).
   * - Formato HH:00 o HH:30 entre 08:00 y 20:00.
   * - Duración mínima de 60 minutos por franja.
   * - Sin solapamiento interno en un mismo profesional.
   * - Sin solapamiento entre Norberto y María (1 sola camilla en el consultorio).
   */
  function validatePractitionerHours(hoursInput) {
    const errors = [];
    const conflicts = [];
    const normalized = { norberto: {}, maria: {} };

    if (!hoursInput || typeof hoursInput !== "object") {
      return {
        isValid: false,
        errors: ["El formato de horarios es inválido."],
        conflicts: [],
        normalized: clonePractitionerHours(DEFAULT_PRACTITIONER_HOURS),
      };
    }

    const parsedByDay = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };

    ["maria", "norberto"].forEach(function (pid) {
      const pLabel = pid === "maria" ? "María" : "Norberto";
      const pSource = hoursInput[pid];
      if (!pSource || typeof pSource !== "object") return;

      Object.keys(pSource).forEach(function (rawKey) {
        const dow = parseInt(rawKey, 10);
        const rawList = pSource[rawKey];
        if (!Array.isArray(rawList) || rawList.length === 0) return;
        if (dow < 1 || dow > 5 || isNaN(dow)) {
          errors.push(`Solo se permiten días de lunes a viernes (${pLabel}).`);
          return;
        }
        const dayName = DAY_NAMES_ES[dow];
        if (rawList.length > 2) {
          errors.push(`${pLabel} (${dayName}): se permiten hasta 2 franjas horarias por día.`);
          return;
        }

        const dayRanges = [];
        rawList.forEach(function (item, idx) {
          const start = item && typeof item.start === "string" ? item.start.trim() : "";
          const end = item && typeof item.end === "string" ? item.end.trim() : "";
          if (!isValidTimeFormat(start) || !isValidTimeFormat(end)) {
            errors.push(`${pLabel} (${dayName}, franja ${idx + 1}): formato de hora inválido (usar HH:00 o HH:30).`);
            return;
          }
          const startMin = parseHmToMinutes(start);
          const endMin = parseHmToMinutes(end);
          if (startMin < 8 * 60 || endMin > 20 * 60) {
            errors.push(`${pLabel} (${dayName}: ${start} a ${end}): el horario debe estar entre las 08:00 y las 20:00 hs.`);
            return;
          }
          if (endMin <= startMin) {
            errors.push(`${pLabel} (${dayName}: ${start} a ${end}): la hora de fin debe ser posterior a la de inicio.`);
            return;
          }
          if (endMin - startMin < SESSION_DURATION_MINUTES) {
            errors.push(`${pLabel} (${dayName}: ${start} a ${end}): cada franja debe durar al menos 60 minutos.`);
            return;
          }
          dayRanges.push({ start: start, end: end, startMin: startMin, endMin: endMin });
        });

        dayRanges.sort(function (a, b) {
          return a.startMin - b.startMin;
        });

        if (dayRanges.length === 2) {
          if (dayRanges[0].endMin > dayRanges[1].startMin) {
            errors.push(
              `${pLabel} (${dayName}): las dos franjas del mismo día se superponen (${dayRanges[0].start}–${dayRanges[0].end} y ${dayRanges[1].start}–${dayRanges[1].end}).`
            );
          }
        }

        if (dayRanges.length > 0) {
          parsedByDay[dow][pid] = dayRanges;
          normalized[pid][dow] = dayRanges.map(function (r) {
            return { start: r.start, end: r.end };
          });
        }
      });
    });

    // Verificar no-solapamiento entre María y Norberto (1 sola camilla)
    [1, 2, 3, 4, 5].forEach(function (dow) {
      const mList = parsedByDay[dow].maria || [];
      const nList = parsedByDay[dow].norberto || [];
      const dayName = DAY_NAMES_ES[dow];
      mList.forEach(function (mRange) {
        nList.forEach(function (nRange) {
          const overlapStart = Math.max(mRange.startMin, nRange.startMin);
          const overlapEnd = Math.min(mRange.endMin, nRange.endMin);
          if (overlapStart < overlapEnd) {
            const msg = `Superposición de camilla el ${dayName}: María (${mRange.start} a ${mRange.end}) se pisa con Norberto (${nRange.start} a ${nRange.end}) entre las ${minutesToHm(overlapStart)} y las ${minutesToHm(overlapEnd)} hs.`;
            errors.push(msg);
            conflicts.push({
              day: dow,
              dayName: dayName,
              overlapStart: minutesToHm(overlapStart),
              overlapEnd: minutesToHm(overlapEnd),
              maria: { start: mRange.start, end: mRange.end },
              norberto: { start: nRange.start, end: nRange.end },
              message: msg,
            });
          }
        });
      });
    });

    return {
      isValid: errors.length === 0,
      errors: errors,
      conflicts: conflicts,
      normalized: normalized,
    };
  }

  /**
   * Actualiza en caliente los horarios de atención de los profesionales en el motor.
   * Mantiene la referencia de PRACTITIONER_HOURS.
   */
  function setPractitionerHours(hoursInput) {
    const check = validatePractitionerHours(hoursInput);
    if (!check.isValid) {
      return check;
    }
    ["norberto", "maria"].forEach(function (pid) {
      PRACTITIONER_HOURS[pid] = {};
      Object.keys(check.normalized[pid]).forEach(function (dow) {
        PRACTITIONER_HOURS[pid][dow] = check.normalized[pid][dow].map(function (r) {
          return { start: r.start, end: r.end };
        });
      });
    });
    return check;
  }

  function resetPractitionerHours() {
    return setPractitionerHours(DEFAULT_PRACTITIONER_HOURS);
  }

  function getPractitionerHours() {
    return clonePractitionerHours(PRACTITIONER_HOURS);
  }

  function joinDayNamesEs(names) {
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} y ${names[1]}`;
    return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  }

  /**
   * Genera el bloque de texto normativo para el prompt de Clara (WhatsApp / n8n).
   */
  function formatClaraScheduleSummary(hoursInput) {
    const source = hoursInput ? clonePractitionerHours(hoursInput) : PRACTITIONER_HOURS;
    const lines = ["Horarios oficiales:"];

    [
      { id: "maria", title: "Lic. María Gulín", shortName: "María" },
      { id: "norberto", title: "Lic. Norberto Brude", shortName: "Norberto" },
    ].forEach(function (prof) {
      lines.push(`- ${prof.title}:`);
      const pHours = (source && source[prof.id]) || {};
      const offDays = [];

      [1, 2, 3, 4, 5].forEach(function (dow) {
        const dayName = DAY_NAMES_ES[dow];
        const ranges = pHours[dow] || [];
        if (!Array.isArray(ranges) || ranges.length === 0) {
          offDays.push(dayName);
          return;
        }
        if (ranges.length === 1) {
          const r = ranges[0];
          const endMin = parseHmToMinutes(r.end);
          const lastTurn = minutesToHm(endMin - SESSION_DURATION_MINUTES);
          lines.push(
            `  * ${dayName}: ${r.start} a ${r.end} hs (turnos de ${r.start} a ${lastTurn} hs inclusive; el último turno finaliza a las ${r.end} hs).`
          );
        } else {
          const parts = ranges.map(function (r, idx) {
            const endMin = parseHmToMinutes(r.end);
            const lastTurn = minutesToHm(endMin - SESSION_DURATION_MINUTES);
            if (idx === ranges.length - 1) {
              return `${r.start} a ${r.end} hs (turnos de ${r.start} a ${lastTurn} hs inclusive; el último turno finaliza a las ${r.end} hs)`;
            }
            return `${r.start} a ${r.end} hs (turnos de ${r.start} a ${lastTurn} hs inclusive)`;
          });
          lines.push(`  * ${dayName}: ${parts.join(" y ")}.`);
        }
      });

      if (offDays.length === 5) {
        lines.push(`  * Lunes a Viernes: ${prof.shortName} sin horarios de consultorio asignados.`);
      } else if (offDays.length > 0) {
        lines.push(`  * ${joinDayNamesEs(offDays)}: ${prof.shortName} no atiende en consultorio.`);
      }
    });

    return lines.join("\n");
  }

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
   * Si practitionerId no se especifica (null), devuelve todas las ventanas de atención del consultorio ese día.
   */
  function getWorkingWindows(practitionerId, dateInput) {
    const d = typeof dateInput === "string" ? parseLocalDate(dateInput) : new Date(dateInput);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return [];

    if (!practitionerId) {
      const combined = [];
      Object.keys(PRACTITIONERS).forEach(function (id) {
        const hours = PRACTITIONER_HOURS[id];
        if (!hours) return;
        const ranges = hours[dow] || [];
        ranges.forEach(function (range) {
          combined.push({ startMin: parseHmToMinutes(range.start), endMin: parseHmToMinutes(range.end) });
        });
      });
      combined.sort(function (a, b) { return a.startMin - b.startMin; });
      return combined;
    }

    const hours = PRACTITIONER_HOURS[practitionerId];
    if (!hours) return [];
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

    // Regla de máximo 60 días
    const now = options.now ? new Date(options.now) : new Date();
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetZero = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    const diffDays = Math.round((targetZero.getTime() - todayZero.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays > MAX_BOOKING_DAYS) {
      return [];
    }

    const windows = getWorkingWindows(practitionerId, baseDate);
    if (!windows.length) return [];

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
            const onDuty = practitionerId || (practitionersAt(baseDate, formatTime(current))[0] || null);
            slots.push({
              time: formatTime(current),
              startIso: new Date(slotStart).toISOString(),
              endIso: new Date(slotEnd).toISOString(),
              durationMinutes: durationMinutes,
              practitionerId: onDuty,
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

    if (req.email !== undefined && req.email !== null && String(req.email).trim() !== "") {
      const email = String(req.email).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("El correo electrónico ingresado no es válido.");
      }
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
        const today = req.now ? new Date(req.now) : new Date();
        const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const targetZero = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffDays = Math.round((targetZero.getTime() - todayZero.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays > MAX_BOOKING_DAYS) {
          errors.push(`Los turnos se pueden solicitar a un máximo de ${MAX_BOOKING_DAYS} días.`);
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
    } else if (req.practitionerId && (!PRACTITIONERS[req.practitionerId] || !practitionerOffersTechnique(req.practitionerId, req.techniqueId))) {
      errors.push("Esa técnica no la atiende el profesional elegido.");
    } else if (!req.practitionerId && technique.practitioners.length < 2) {
      errors.push("Elegí el profesional de la sesión.");
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
    } else if (
      technique &&
      !technique.bySchedule &&
      req.date &&
      req.time &&
      !req.practitionerId
    ) {
      const timeMin = parseHmToMinutes(req.time);
      const fitsAny = technique.practitioners.some(function (pid) {
        const windows = getWorkingWindows(pid, req.date);
        return windows.some(function (w) {
          return timeMin >= w.startMin && timeMin + SESSION_DURATION_MINUTES <= w.endMin;
        });
      });
      if (!fitsAny) {
        errors.push("Ese horario está fuera del horario de atención del consultorio.");
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
    const especialidad = data.techniqueId === "no-se"
      ? "No especifica"
      : (technique && !technique.internal ? technique.label : data.especialidad || data.motivo || "No especifica");

    const parts = [
      `📱 WhatsApp: ${data.telefono.trim()}`,
      `📧 Email: ${String(data.email || "").trim()}`,
      `🪪 DNI: ${data.dni ? data.dni.trim() : "No provisto"}`,
      `🌿 Origen: Reserva Web Oficial Kinésica`,
    ];
    if (who) parts.push(`👤 Profesional: ${who.name}`);
    if (data.techniqueId || data.especialidad) {
      parts.push(`📋 Especialidad: ${especialidad}`);
    } else if (data.motivo && data.motivo.trim()) {
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
    const title = technique && !technique.internal
      ? `Turno en Kinésica — ${technique.label}`
      : "Turno en Kinésica";

    const location = "Charcas 3889, Piso 5º B, Palermo, CABA (entre Scalabrini Ortiz y Aráoz)";

    const specialtyLabel = payload.techniqueId === "no-se"
      ? "No especifica"
      : (technique && !technique.internal ? technique.label : (payload.especialidad || ""));

    const specialtyLine = specialtyLabel ? `Especialidad: ${specialtyLabel}.` : "";

    const description = [
      "Información importante:",
      "- Te pedimos que llegues a la hora de la sesión, ni antes ni después, por características del espacio y la organización.",
      "- Asistir sin acompañantes (salvo necesidad directa o menores).",
      "- Traer estudios médicos previos si contás con ellos.",
      specialtyLine,
      who ? `Profesional: ${who.id === "maria" ? "mujer" : "hombre"}.` : "",
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
    DEFAULT_PRACTITIONER_HOURS: DEFAULT_PRACTITIONER_HOURS,
    PRACTITIONER_HOURS: PRACTITIONER_HOURS,
    MAX_BOOKING_DAYS: MAX_BOOKING_DAYS,
    DEFAULT_ARGENTINA_HOLIDAYS: DEFAULT_ARGENTINA_HOLIDAYS,
    clonePractitionerHours: clonePractitionerHours,
    validatePractitionerHours: validatePractitionerHours,
    setPractitionerHours: setPractitionerHours,
    resetPractitionerHours: resetPractitionerHours,
    getPractitionerHours: getPractitionerHours,
    formatClaraScheduleSummary: formatClaraScheduleSummary,
    parseHmToMinutes: parseHmToMinutes,
    minutesToHm: minutesToHm,
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
