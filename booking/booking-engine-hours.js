/**
 * Kinésica - Validación y Gestión de Horarios de Profesionales
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine-config"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine-config"));
  } else {
    root.KinesicaBookingEngineHours = factory(root.KinesicaBookingEngineConfig);
  }
})(typeof self !== "undefined" ? self : this, function (cfg) {
  "use strict";

  const SESSION_DURATION_MINUTES = cfg.SESSION_DURATION_MINUTES;
  const DEFAULT_PRACTITIONER_HOURS = cfg.DEFAULT_PRACTITIONER_HOURS;
  const PRACTITIONER_HOURS = cfg.PRACTITIONER_HOURS;
  const DAY_NAMES_ES = cfg.DAY_NAMES_ES;
  const clonePractitionerHours = cfg.clonePractitionerHours;
  const parseHmToMinutes = cfg.parseHmToMinutes;
  const minutesToHm = cfg.minutesToHm;
  const isValidTimeFormat = cfg.isValidTimeFormat;

  /**
   * Valida la estructura completa de horarios de los profesionales:
   * - Hasta 2 franjas por día (Lunes a Viernes, claves 1..5).
   * - Formato HH:00 o HH:30 entre 08:00 y 20:00.
   * - Duración mínima de 60 minutos por franja.
   * - Sin solapamiento interno ni entre Norberto y María (1 sola camilla).
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
          dayRanges.push({ start, end, startMin, endMin });
        });

        dayRanges.sort(function (a, b) { return a.startMin - b.startMin; });

        if (dayRanges.length === 2 && dayRanges[0].endMin > dayRanges[1].startMin) {
          errors.push(
            `${pLabel} (${dayName}): las dos franjas del mismo día se superponen (${dayRanges[0].start}–${dayRanges[0].end} y ${dayRanges[1].start}–${dayRanges[1].end}).`
          );
        }

        if (dayRanges.length > 0) {
          parsedByDay[dow][pid] = dayRanges;
          normalized[pid][dow] = dayRanges.map(function (r) {
            return { start: r.start, end: r.end };
          });
        }
      });
    });

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
              dayName,
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

    return { isValid: errors.length === 0, errors, conflicts, normalized };
  }

  function setPractitionerHours(hoursInput) {
    const check = validatePractitionerHours(hoursInput);
    if (!check.isValid) return check;
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

  function formatClaraScheduleSummary(hoursInput) {
    const source = hoursInput ? clonePractitionerHours(hoursInput) : PRACTITIONER_HOURS;
    const lines = ["Horarios oficiales:"];

    [
      { id: "maria", title: "Lic. María Gulin", shortName: "María" },
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
          const lastTurn = minutesToHm(parseHmToMinutes(r.end) - SESSION_DURATION_MINUTES);
          lines.push(
            `  * ${dayName}: ${r.start} a ${r.end} hs (turnos de ${r.start} a ${lastTurn} hs inclusive; el último turno finaliza a las ${r.end} hs).`
          );
        } else {
          const parts = ranges.map(function (r, idx) {
            const lastTurn = minutesToHm(parseHmToMinutes(r.end) - SESSION_DURATION_MINUTES);
            return idx === ranges.length - 1
              ? `${r.start} a ${r.end} hs (turnos de ${r.start} a ${lastTurn} hs inclusive; el último turno finaliza a las ${r.end} hs)`
              : `${r.start} a ${r.end} hs (turnos de ${r.start} a ${lastTurn} hs inclusive)`;
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

  return {
    validatePractitionerHours,
    setPractitionerHours,
    resetPractitionerHours,
    getPractitionerHours,
    formatClaraScheduleSummary,
  };
});
