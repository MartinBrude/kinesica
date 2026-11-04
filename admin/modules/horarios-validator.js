/**
 * Kinésica Admin - Validador de Horarios y Franjas de Consultorio
 * Restricciones de 1 sola camilla física, duración mínima de 60 min y generación de resúmenes.
 */

export const DEFAULT_HEADER_SCHEDULE = { opens: "08:00", closes: "19:30" };

export const DEFAULT_PRACTITIONER_HOURS = {
  norberto: {
    1: [{ start: "17:30", end: "19:30" }],
    2: [{ start: "16:30", end: "19:30" }],
    3: [{ start: "09:00", end: "16:30" }],
    4: [{ start: "15:00", end: "19:00" }],
    5: [{ start: "13:30", end: "19:30" }],
  },
  maria: {
    1: [{ start: "09:00", end: "17:00" }],
    2: [{ start: "09:00", end: "16:00" }],
    5: [{ start: "09:00", end: "13:00" }],
  },
};

export const DAYS = [
  { dow: 1, name: "Lunes", short: "Lun" },
  { dow: 2, name: "Martes", short: "Mar" },
  { dow: 3, name: "Miércoles", short: "Mié" },
  { dow: 4, name: "Jueves", short: "Jue" },
  { dow: 5, name: "Viernes", short: "Vie" },
];

export const PROF_META = [
  {
    id: "maria",
    name: "Lic. María Gulin",
    shortName: "María",
    specialties: "Kinesiología · RPG · ATM · Acupuntura · Posturología",
    cardClass: "maria-card",
  },
  {
    id: "norberto",
    name: "Lic. Norberto Brude",
    shortName: "Norberto",
    specialties: "Kinesiología · Osteopatía · RPG · ATM · Barral",
    cardClass: "norberto-card",
  },
];

export const TIMELINE_START_MIN = 8 * 60; // 08:00
export const TIMELINE_END_MIN = 20 * 60;  // 20:00
export const TIMELINE_SPAN_MIN = TIMELINE_END_MIN - TIMELINE_START_MIN; // 720 min

export function hmToMin(hm) {
  const parts = String(hm || "00:00").split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
}

export function minToHm(totalMin) {
  const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const m = String(totalMin % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function buildTimeOptions(minHour = 8, maxHour = 20) {
  const opts = [];
  for (let m = minHour * 60; m <= maxHour * 60; m += 30) opts.push(minToHm(m));
  return opts;
}

export function cloneHours(source) {
  const src = source || DEFAULT_PRACTITIONER_HOURS;
  const out = { norberto: {}, maria: {} };
  ["norberto", "maria"].forEach((pid) => {
    const pDays = (src && src[pid]) || {};
    Object.keys(pDays).forEach((dow) => {
      const list = pDays[dow];
      if (Array.isArray(list) && list.length > 0) {
        out[pid][dow] = list.map((r) => ({
          start: String(r.start || "09:00"),
          end: String(r.end || "13:00"),
        }));
      }
    });
  });
  return out;
}

export function formatHeaderScheduleText(opens, closes) {
  function formatHm24(hm) {
    const parts = String(hm || "").split(":");
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return m === 0 ? String(h) : `${h}:${String(m).padStart(2, "0")}`;
  }
  return `Lunes a viernes: <strong>${formatHm24(opens)} a ${formatHm24(closes)} h</strong>`;
}

export function validateHoursDraft(hoursInput) {
  if (
    typeof window !== "undefined" &&
    window.KinesicaBookingEngine &&
    typeof window.KinesicaBookingEngine.validatePractitionerHours === "function"
  ) {
    return window.KinesicaBookingEngine.validatePractitionerHours(hoursInput);
  }

  const errors = [];
  const conflicts = [];
  const normalized = { norberto: {}, maria: {} };
  const parsedByDay = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };

  ["maria", "norberto"].forEach((pid) => {
    const pLabel = pid === "maria" ? "María" : "Norberto";
    const pSource = (hoursInput && hoursInput[pid]) || {};
    DAYS.forEach(({ dow, name: dayName }) => {
      const rawList = pSource[dow] || pSource[String(dow)] || [];
      if (!Array.isArray(rawList) || rawList.length === 0) return;
      if (rawList.length > 2) {
        errors.push(`${pLabel} (${dayName}): máximo 2 franjas por día.`);
        return;
      }
      const dayRanges = [];
      rawList.forEach((item) => {
        const start = String(item?.start || "").trim();
        const end = String(item?.end || "").trim();
        const startMin = hmToMin(start);
        const endMin = hmToMin(end);
        if (startMin < 8 * 60 || endMin > 20 * 60) {
          errors.push(`${pLabel} (${dayName}): horario fuera de 08:00 a 20:00 hs.`);
          return;
        }
        if (endMin - startMin < 60) {
          errors.push(`${pLabel} (${dayName}: ${start} a ${end}): cada franja debe durar al menos 60 minutos.`);
          return;
        }
        dayRanges.push({ start, end, startMin, endMin });
      });
      dayRanges.sort((a, b) => a.startMin - b.startMin);
      if (dayRanges.length === 2 && dayRanges[0].endMin > dayRanges[1].startMin) {
        errors.push(`${pLabel} (${dayName}): las dos franjas del mismo día se superponen entre sí.`);
      }
      parsedByDay[dow][pid] = dayRanges;
      normalized[pid][dow] = dayRanges.map((r) => ({ start: r.start, end: r.end }));
    });
  });

  DAYS.forEach(({ dow, name: dayName }) => {
    const mList = parsedByDay[dow].maria || [];
    const nList = parsedByDay[dow].norberto || [];
    mList.forEach((mRange) => {
      nList.forEach((nRange) => {
        const overlapStart = Math.max(mRange.startMin, nRange.startMin);
        const overlapEnd = Math.min(mRange.endMin, nRange.endMin);
        if (overlapStart < overlapEnd) {
          const msg = `Superposición de camilla el ${dayName}: María (${mRange.start} a ${mRange.end}) se pisa con Norberto (${nRange.start} a ${nRange.end}) entre las ${minToHm(overlapStart)} y las ${minToHm(overlapEnd)} hs.`;
          errors.push(msg);
          conflicts.push({
            day: dow,
            dayName,
            overlapStart: minToHm(overlapStart),
            overlapEnd: minToHm(overlapEnd),
            message: msg,
          });
        }
      });
    });
  });

  return { isValid: errors.length === 0, errors, conflicts, normalized };
}

export function buildClaraPreviewText(hoursInput) {
  if (
    typeof window !== "undefined" &&
    window.KinesicaBookingEngine &&
    typeof window.KinesicaBookingEngine.formatClaraScheduleSummary === "function"
  ) {
    return window.KinesicaBookingEngine.formatClaraScheduleSummary(hoursInput);
  }
  const lines = ["Horarios oficiales:"];
  PROF_META.forEach((prof) => {
    lines.push(`- ${prof.name}:`);
    const pHours = (hoursInput && hoursInput[prof.id]) || {};
    const off = [];
    DAYS.forEach(({ dow, name }) => {
      const list = pHours[dow] || pHours[String(dow)] || [];
      if (!list.length) {
        off.push(name);
        return;
      }
      const parts = list.map((r, i) => {
        const lastTurn = minToHm(hmToMin(r.end) - 60);
        return i === list.length - 1
          ? `${r.start} a ${r.end} hs (turnos de ${r.start} a ${lastTurn} hs inclusive; el último turno finaliza a las ${r.end} hs)`
          : `${r.start} a ${r.end} hs (turnos de ${r.start} a ${lastTurn} hs inclusive)`;
      });
      lines.push(`  * ${name}: ${parts.join(" y ")}.`);
    });
    if (off.length) {
      lines.push(`  * ${off.join(", ")}: ${prof.shortName} no atiende en consultorio.`);
    }
  });
  return lines.join("\n");
}

/**
 * Infiere si un turno corresponde a Norberto o María según día, horario y metadatos.
 * Respeta la regla física de 1 sola camilla: turnos de ambos jamás se solapan.
 * - Miércoles y Jueves: Norberto (María no atiende).
 * - Lunes: María 09:00 a 17:00 | Norberto 17:30 a 19:30.
 * - Martes: María 09:00 a 16:00 | Norberto 16:30 a 19:30.
 * - Viernes: María 09:00 a 13:00 | Norberto 13:30 a 19:30.
 *
 * @param {string|number} dateOrDow
 * @param {string} [timeStr]
 * @param {string} [creatorOrSummary]
 * @returns {"norberto"|"maria"|"indistinto"}
 */
export function inferPractitionerFromSlot(dateOrDow, timeStr = "", creatorOrSummary = "") {
  if (creatorOrSummary) {
    const meta = String(creatorOrSummary).toLowerCase();
    if (meta.includes("norberto1712@gmail.com") || /\b(?:norberto|lic\.?\s*brude)\b/i.test(meta)) {
      return "norberto";
    }
    if (meta.includes("manosmagicas7116@gmail.com") || /\b(?:maria|gulin|lic\.?\s*gulin)\b/i.test(meta)) {
      return "maria";
    }
  }

  let dow = null;
  const raw = String(dateOrDow || "").trim();
  if (/^[1-7]$/.test(raw)) {
    dow = parseInt(raw, 10);
  } else if (/\b(?:miercoles|miércoles|mie|mié)\b/i.test(raw)) {
    dow = 3;
  } else if (/\b(?:jueves|jue)\b/i.test(raw)) {
    dow = 4;
  } else if (/\b(?:lunes|lun)\b/i.test(raw)) {
    dow = 1;
  } else if (/\b(?:martes|mar)\b/i.test(raw)) {
    dow = 2;
  } else if (/\b(?:viernes|vie)\b/i.test(raw)) {
    dow = 5;
  } else if (raw) {
    const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00-03:00`);
    if (!isNaN(d.getTime())) {
      const getDay = d.getDay(); // 0 Sun, 1 Mon ... 6 Sat
      dow = getDay === 0 ? 7 : getDay;
      if (!timeStr && raw.includes("T")) {
        const timePart = raw.split("T")[1];
        if (timePart) timeStr = timePart.substring(0, 5);
      }
    }
  }

  if (!dow) return "indistinto";
  if (dow === 3 || dow === 4) return "norberto";

  let minutes = null;
  if (timeStr && /^\d{1,2}:\d{2}/.test(timeStr.trim())) {
    const [h, m] = timeStr.trim().split(":").map((v) => parseInt(v, 10));
    minutes = h * 60 + (m || 0);
  }

  if (minutes === null) return "indistinto";

  if (dow === 1) return minutes >= 17 * 60 + 15 ? "norberto" : "maria";
  if (dow === 2) return minutes >= 16 * 60 + 15 ? "norberto" : "maria";
  if (dow === 5) return minutes >= 13 * 60 + 15 ? "norberto" : "maria";

  return "indistinto";
}
