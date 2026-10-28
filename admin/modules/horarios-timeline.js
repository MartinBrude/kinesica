/**
 * Kinésica Admin - Renderizado de Línea de Tiempo de Horarios y Estadísticas
 * Grilla visual de uso de la camilla física y cálculo de horas semanales por profesional.
 */

import {
  DAYS,
  TIMELINE_START_MIN,
  TIMELINE_END_MIN,
  TIMELINE_SPAN_MIN,
  hmToMin,
  minToHm,
} from "./horarios-validator.js";

export function computeProfWeeklyStats(draftHours, pid) {
  const pDays = (draftHours && draftHours[pid]) || {};
  let totalMinutes = 0;
  let activeDays = 0;
  DAYS.forEach(({ dow }) => {
    const list = pDays[dow] || pDays[String(dow)] || [];
    if (list.length > 0) {
      activeDays += 1;
      list.forEach((r) => {
        const diff = hmToMin(r.end) - hmToMin(r.start);
        if (diff > 0) totalMinutes += diff;
      });
    }
  });
  const hoursNum = totalMinutes / 60;
  const hoursStr = Number.isInteger(hoursNum) ? String(hoursNum) : hoursNum.toFixed(1).replace(".0", "");
  return `${activeDays} ${activeDays === 1 ? "día" : "días"} · ${hoursStr} hs/sem`;
}

export function renderTimeline(timelineRowsEl, draftHours, validation) {
  if (!timelineRowsEl) return;
  timelineRowsEl.innerHTML = "";

  DAYS.forEach(({ dow, name }) => {
    const row = document.createElement("div");
    row.className = "horarios-timeline-row";

    const dayLabel = document.createElement("div");
    dayLabel.className = "horarios-timeline-day";
    dayLabel.textContent = name;

    const track = document.createElement("div");
    track.className = "horarios-timeline-track";

    ["maria", "norberto"].forEach((pid) => {
      const list = (draftHours[pid] && (draftHours[pid][dow] || draftHours[pid][String(dow)])) || [];
      list.forEach((r) => {
        const sMin = Math.max(TIMELINE_START_MIN, hmToMin(r.start));
        const eMin = Math.min(TIMELINE_END_MIN, hmToMin(r.end));
        if (eMin <= sMin) return;
        const leftPct = ((sMin - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN) * 100;
        const widthPct = ((eMin - sMin) / TIMELINE_SPAN_MIN) * 100;

        const block = document.createElement("div");
        block.className = `horarios-timeline-block ${pid}`;
        block.style.left = `${leftPct.toFixed(2)}%`;
        block.style.width = `${widthPct.toFixed(2)}%`;
        const shortLabel = pid === "maria" ? "María" : "Norberto";
        block.textContent = `${shortLabel} ${r.start}–${r.end}`;
        block.title = `${shortLabel}: ${r.start} a ${r.end} hs`;
        track.appendChild(block);
      });
    });

    const dayConflicts = (validation.conflicts || []).filter((c) => Number(c.day) === dow);
    dayConflicts.forEach((c) => {
      const sMin = Math.max(TIMELINE_START_MIN, hmToMin(c.overlapStart));
      const eMin = Math.min(TIMELINE_END_MIN, hmToMin(c.overlapEnd));
      if (eMin <= sMin) return;
      const leftPct = ((sMin - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN) * 100;
      const widthPct = ((eMin - sMin) / TIMELINE_SPAN_MIN) * 100;

      const conflictEl = document.createElement("div");
      conflictEl.className = "horarios-timeline-block conflict";
      conflictEl.style.left = `${leftPct.toFixed(2)}%`;
      conflictEl.style.width = `${widthPct.toFixed(2)}%`;
      conflictEl.textContent = `⚠ ${c.overlapStart}–${c.overlapEnd}`;
      conflictEl.title = c.message;
      track.appendChild(conflictEl);
    });

    row.append(dayLabel, track);
    timelineRowsEl.appendChild(row);
  });
}

export function findNonCollidingDefaultRange(draftHours, pid, dow) {
  const otherId = pid === "maria" ? "norberto" : "maria";
  const otherRanges = (draftHours[otherId] && (draftHours[otherId][dow] || draftHours[otherId][String(dow)])) || [];
  if (otherRanges.length === 0) {
    return pid === "maria" ? { start: "09:00", end: "14:00" } : { start: "15:00", end: "19:00" };
  }
  const firstOtherStart = hmToMin(otherRanges[0].start);
  const lastOtherEnd = hmToMin(otherRanges[otherRanges.length - 1].end);

  if (firstOtherStart >= 13 * 60) {
    const endM = Math.min(14 * 60, firstOtherStart);
    return { start: "09:00", end: minToHm(endM) };
  }
  if (lastOtherEnd <= 16 * 60) {
    const startM = Math.max(15 * 60, lastOtherEnd);
    return { start: minToHm(startM), end: "19:00" };
  }
  return { start: "09:00", end: "13:00" };
}
