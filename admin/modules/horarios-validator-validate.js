/** Validación de borrador de horarios (1 camilla, franjas ≥60 min). */

import { DAYS, hmToMin, minToHm } from "./horarios-validator-core.js?v=1";

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
