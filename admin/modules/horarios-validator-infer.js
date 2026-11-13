/** Preview Clara e inferencia de profesional por franja. */

import { DAYS, PROF_META, hmToMin, minToHm } from "./horarios-validator-core.js?v=1";

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
      const getDay = d.getDay();
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
