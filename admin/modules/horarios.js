/**
 * Kinésica Admin - Módulo de Configuración de Horarios por Profesional
 * Permite visualizar y editar los días y franjas de atención de María y Norberto,
 * validando la restricción de 1 sola camilla física y sincronizando con Agendar y Clara.
 */

import { api } from "./api.js?v=77";
import { escapeHtml, dialogAlert, dialogConfirm } from "./dom.js?v=78";

const viewHorarios = document.querySelector("#view-horarios");
const timelineRowsEl = document.querySelector("#horarios-timeline-rows");
const editorsGridEl = document.querySelector("#horarios-editors-grid");
const statusBannerEl = document.querySelector("#horarios-status-banner");
const lastUpdatedEl = document.querySelector("#horarios-last-updated");
const claraPreviewEl = document.querySelector("#horarios-clara-preview");
const btnSave = document.querySelector("#btn-save-horarios");
const btnCopyClara = document.querySelector("#btn-copy-clara-horarios");
const selectHeaderOpens = document.querySelector("#select-header-schedule-opens");
const selectHeaderCloses = document.querySelector("#select-header-schedule-closes");
const headerPreviewEl = document.querySelector("#header-schedule-preview");

export const DEFAULT_HEADER_SCHEDULE = { opens: "08:00", closes: "19:00" };
let draftHeaderSchedule = { ...DEFAULT_HEADER_SCHEDULE };

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

const DAYS = [
  { dow: 1, name: "Lunes", short: "Lun" },
  { dow: 2, name: "Martes", short: "Mar" },
  { dow: 3, name: "Miércoles", short: "Mié" },
  { dow: 4, name: "Jueves", short: "Jue" },
  { dow: 5, name: "Viernes", short: "Vie" },
];

const PROF_META = [
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

const TIMELINE_START_MIN = 8 * 60; // 08:00
const TIMELINE_END_MIN = 20 * 60;  // 20:00
const TIMELINE_SPAN_MIN = TIMELINE_END_MIN - TIMELINE_START_MIN; // 720 min

let draftHours = cloneHours(DEFAULT_PRACTITIONER_HOURS);
let isDirty = false;

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

export function hmToMin(hm) {
  const parts = String(hm || "00:00").split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
}

export function minToHm(totalMin) {
  const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const m = String(totalMin % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function buildTimeOptions(minHour = 8, maxHour = 20) {
  const opts = [];
  for (let m = minHour * 60; m <= maxHour * 60; m += 30) {
    opts.push(minToHm(m));
  }
  return opts;
}

const START_TIME_OPTIONS = buildTimeOptions(8, 19);
const END_TIME_OPTIONS = buildTimeOptions(9, 20);
const HEADER_TIME_OPTIONS = buildTimeOptions(8, 20);

export function formatHeaderScheduleText(opens, closes) {
  function formatHm24(hm) {
    const parts = String(hm || "").split(":");
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return m === 0 ? String(h) : `${h}:${String(m).padStart(2, "0")}`;
  }
  return `Lunes a viernes: <strong>${formatHm24(opens)} a ${formatHm24(closes)} h</strong>`;
}

function initHeaderScheduleSelects() {
  if (!selectHeaderOpens || !selectHeaderCloses) return;
  selectHeaderOpens.innerHTML = "";
  selectHeaderCloses.innerHTML = "";

  HEADER_TIME_OPTIONS.forEach((hm) => {
    const optO = document.createElement("option");
    optO.value = hm;
    optO.textContent = `${hm} hs`;
    selectHeaderOpens.appendChild(optO);

    const optC = document.createElement("option");
    optC.value = hm;
    optC.textContent = `${hm} hs`;
    selectHeaderCloses.appendChild(optC);
  });

  selectHeaderOpens.value = draftHeaderSchedule.opens;
  selectHeaderCloses.value = draftHeaderSchedule.closes;

  selectHeaderOpens.addEventListener("change", () => {
    isDirty = true;
    draftHeaderSchedule.opens = selectHeaderOpens.value;
    if (hmToMin(draftHeaderSchedule.closes) <= hmToMin(draftHeaderSchedule.opens)) {
      const nextMin = Math.min(20 * 60, hmToMin(draftHeaderSchedule.opens) + 60);
      draftHeaderSchedule.closes = minToHm(nextMin);
      selectHeaderCloses.value = draftHeaderSchedule.closes;
    }
    refreshUI();
  });

  selectHeaderCloses.addEventListener("change", () => {
    isDirty = true;
    draftHeaderSchedule.closes = selectHeaderCloses.value;
    if (hmToMin(draftHeaderSchedule.closes) <= hmToMin(draftHeaderSchedule.opens)) {
      const prevMin = Math.max(8 * 60, hmToMin(draftHeaderSchedule.closes) - 60);
      draftHeaderSchedule.opens = minToHm(prevMin);
      selectHeaderOpens.value = draftHeaderSchedule.opens;
    }
    refreshUI();
  });
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

export function applyHoursToRuntime(hoursObj) {
  if (!hoursObj) return;
  draftHours = cloneHours(hoursObj);
  if (
    typeof window !== "undefined" &&
    window.KinesicaBookingEngine &&
    typeof window.KinesicaBookingEngine.setPractitionerHours === "function"
  ) {
    window.KinesicaBookingEngine.setPractitionerHours(hoursObj);
  }
  if (
    typeof window !== "undefined" &&
    window.KinesicaBookingModal &&
    typeof window.KinesicaBookingModal.invalidateCache === "function"
  ) {
    window.KinesicaBookingModal.invalidateCache();
  }
  try {
    const pub = JSON.parse(localStorage.getItem("kinesica_public_settings") || "{}") || {};
    pub.practitioner_hours = hoursObj;
    localStorage.setItem("kinesica_public_settings", JSON.stringify(pub));
  } catch (_) {}
}

export function showHorariosView() {
  if (viewHorarios) {
    viewHorarios.hidden = false;
    const views = ["#view-dashboard", "#view-library", "#view-pacientes", "#view-form", "#view-compare", "#view-gate"];
    views.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.hidden = true;
    });
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "horarios" }));
    } catch (_) {}
    loadHorariosFromServer();
  }
}

export function hideHorariosView() {
  if (viewHorarios) {
    viewHorarios.hidden = true;
  }
}

function updateMetaTimestamp(updatedAt, updatedBy) {
  if (!lastUpdatedEl) return;
  if (!updatedAt) {
    lastUpdatedEl.textContent = "✓ Horarios activos sincronizados con Agendar y Clara";
    return;
  }
  try {
    const d = new Date(updatedAt);
    const dateFmt = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeFmt = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const author = updatedBy ? ` por ${updatedBy}` : "";
    lastUpdatedEl.textContent = `✓ Última actualización: ${dateFmt} a las ${timeFmt}${author}`;
  } catch (_) {
    lastUpdatedEl.textContent = "✓ Horarios activos sincronizados";
  }
}

function showStatusBanner(type, messages) {
  if (!statusBannerEl) return;
  if (!messages || messages.length === 0) {
    statusBannerEl.hidden = true;
    statusBannerEl.innerHTML = "";
    return;
  }
  statusBannerEl.hidden = false;
  statusBannerEl.className = `horarios-alert-box ${type === "success" ? "is-success" : ""}`;
  if (messages.length === 1) {
    statusBannerEl.innerHTML = `<strong>${escapeHtml(messages[0])}</strong>`;
  } else {
    const items = messages.map((m) => `<li>${escapeHtml(m)}</li>`).join("");
    statusBannerEl.innerHTML = `<strong>Revisá los siguientes puntos antes de guardar:</strong><ul class="horarios-alert-list">${items}</ul>`;
  }
}

function computeProfWeeklyStats(pid) {
  const pDays = draftHours[pid] || {};
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

function renderTimeline(validation) {
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

    // Renderizar bloque de superposición en rojo si hay conflicto ese día
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

function findNonCollidingDefaultRange(pid, dow) {
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

function renderEditors() {
  if (!editorsGridEl) return;
  const validation = validateHoursDraft(draftHours);
  const conflictDays = new Set((validation.conflicts || []).map((c) => Number(c.day)));

  editorsGridEl.innerHTML = "";

  PROF_META.forEach((prof) => {
    const card = document.createElement("article");
    card.className = `horarios-prof-card ${prof.cardClass}`;

    const header = document.createElement("div");
    header.className = "horarios-prof-header";
    header.innerHTML = `
      <div>
        <h3 class="horarios-prof-title">${escapeHtml(prof.name)}</h3>
        <p class="horarios-prof-subtitle">${escapeHtml(prof.specialties)}</p>
      </div>
      <span class="horarios-prof-stats" data-prof-stats="${prof.id}">${escapeHtml(computeProfWeeklyStats(prof.id))}</span>
    `;
    card.appendChild(header);

    const daysList = document.createElement("div");
    daysList.className = "horarios-days-list";

    DAYS.forEach(({ dow, name: dayName }) => {
      const pDays = draftHours[prof.id] || {};
      const ranges = pDays[dow] || pDays[String(dow)] || [];
      const isWorking = ranges.length > 0;
      const hasConflict = isWorking && conflictDays.has(dow);

      const dayCard = document.createElement("div");
      dayCard.className = `horarios-day-card ${isWorking ? "" : "is-off"} ${hasConflict ? "has-conflict" : ""}`.trim();

      const dayTop = document.createElement("div");
      dayTop.className = "horarios-day-top";

      const labelEl = document.createElement("label");
      labelEl.className = "horarios-day-toggle";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = isWorking;
      checkbox.addEventListener("change", () => {
        isDirty = true;
        if (!draftHours[prof.id]) draftHours[prof.id] = {};
        if (checkbox.checked) {
          draftHours[prof.id][dow] = [findNonCollidingDefaultRange(prof.id, dow)];
        } else {
          delete draftHours[prof.id][dow];
          delete draftHours[prof.id][String(dow)];
        }
        refreshUI();
      });

      const dayText = document.createElement("span");
      dayText.textContent = dayName;
      labelEl.append(checkbox, dayText);

      const rightControls = document.createElement("div");
      rightControls.style.display = "flex";
      rightControls.style.alignItems = "center";
      rightControls.style.gap = "8px";

      if (!isWorking) {
        const badge = document.createElement("span");
        badge.className = "horarios-day-badge";
        badge.textContent = "No atiende en consultorio";
        rightControls.appendChild(badge);
      } else if (ranges.length === 1) {
        const r0EndMin = hmToMin(ranges[0].end);
        if (r0EndMin <= 18 * 60) {
          const btnAdd = document.createElement("button");
          btnAdd.type = "button";
          btnAdd.className = "btn light horarios-btn-add-range";
          btnAdd.textContent = "+ 2ª franja";
          btnAdd.title = "Agregar un segundo bloque horario en el mismo día (ej. mañana y tarde)";
          btnAdd.addEventListener("click", () => {
            isDirty = true;
            const nextStartMin = Math.min(18 * 60, Math.max(r0EndMin + 30, 15 * 60));
            const nextEndMin = Math.min(20 * 60, Math.max(nextStartMin + 60, 19 * 60));
            draftHours[prof.id][dow] = [
              ranges[0],
              { start: minToHm(nextStartMin), end: minToHm(nextEndMin) },
            ];
            refreshUI();
          });
          rightControls.appendChild(btnAdd);
        }
      }

      dayTop.append(labelEl, rightControls);
      dayCard.appendChild(dayTop);

      if (isWorking) {
        const rangesWrap = document.createElement("div");
        rangesWrap.className = "horarios-ranges-wrap";

        ranges.forEach((rangeObj, rIdx) => {
          const rangeRow = document.createElement("div");
          rangeRow.className = "horarios-range-row";

          const startSelect = document.createElement("select");
          startSelect.setAttribute("aria-label", `${prof.shortName} ${dayName} inicio franja ${rIdx + 1}`);
          START_TIME_OPTIONS.forEach((hm) => {
            const opt = document.createElement("option");
            opt.value = hm;
            opt.textContent = `${hm} hs`;
            if (hm === rangeObj.start) opt.selected = true;
            startSelect.appendChild(opt);
          });

          const sep = document.createElement("span");
          sep.className = "horarios-range-sep";
          sep.textContent = "a";

          const endSelect = document.createElement("select");
          endSelect.setAttribute("aria-label", `${prof.shortName} ${dayName} fin franja ${rIdx + 1}`);
          END_TIME_OPTIONS.forEach((hm) => {
            const opt = document.createElement("option");
            opt.value = hm;
            opt.textContent = `${hm} hs`;
            if (hm === rangeObj.end) opt.selected = true;
            endSelect.appendChild(opt);
          });

          startSelect.addEventListener("change", () => {
            isDirty = true;
            const newStart = startSelect.value;
            let newEnd = endSelect.value;
            if (hmToMin(newEnd) - hmToMin(newStart) < 60) {
              newEnd = minToHm(Math.min(20 * 60, hmToMin(newStart) + 60));
            }
            draftHours[prof.id][dow][rIdx] = { start: newStart, end: newEnd };
            refreshUI();
          });

          endSelect.addEventListener("change", () => {
            isDirty = true;
            draftHours[prof.id][dow][rIdx] = { start: startSelect.value, end: endSelect.value };
            refreshUI();
          });

          const durationMin = hmToMin(rangeObj.end) - hmToMin(rangeObj.start);
          const hint = document.createElement("span");
          hint.className = "horarios-range-hint";
          if (durationMin >= 60) {
            const lastTurn = minToHm(hmToMin(rangeObj.end) - 60);
            hint.textContent = `Último turno: ${lastTurn} hs`;
          } else {
            hint.style.color = "#dc2626";
            hint.textContent = "Mínimo 1 hora";
          }

          rangeRow.append(startSelect, sep, endSelect, hint);

          if (rIdx > 0) {
            const btnRemove = document.createElement("button");
            btnRemove.type = "button";
            btnRemove.className = "btn ghost horarios-btn-remove-range";
            btnRemove.textContent = "✕";
            btnRemove.title = "Quitar segunda franja";
            btnRemove.addEventListener("click", () => {
              isDirty = true;
              draftHours[prof.id][dow].splice(rIdx, 1);
              refreshUI();
            });
            rangeRow.appendChild(btnRemove);
          }

          rangesWrap.appendChild(rangeRow);
        });

        dayCard.appendChild(rangesWrap);
      }

      daysList.appendChild(dayCard);
    });

    card.appendChild(daysList);
    editorsGridEl.appendChild(card);
  });
}

function refreshUI() {
  const validation = validateHoursDraft(draftHours);
  renderTimeline(validation);
  renderEditors();

  if (claraPreviewEl) {
    claraPreviewEl.textContent = buildClaraPreviewText(draftHours);
  }

  if (selectHeaderOpens && selectHeaderOpens.value !== draftHeaderSchedule.opens) {
    selectHeaderOpens.value = draftHeaderSchedule.opens;
  }
  if (selectHeaderCloses && selectHeaderCloses.value !== draftHeaderSchedule.closes) {
    selectHeaderCloses.value = draftHeaderSchedule.closes;
  }
  if (headerPreviewEl) {
    headerPreviewEl.innerHTML = formatHeaderScheduleText(
      draftHeaderSchedule.opens,
      draftHeaderSchedule.closes
    );
  }

  if (btnSave) {
    btnSave.disabled = !validation.isValid;
  }

  if (!validation.isValid) {
    showStatusBanner("error", validation.errors);
  } else if (isDirty) {
    showStatusBanner("success", ["Horarios válidos (sin superposición de camilla). Hacé clic en «Guardar horarios» para aplicarlos."]);
  } else {
    showStatusBanner("success", []);
  }
}

export async function loadHorariosFromServer() {
  try {
    const res = await api("horarios.php");
    if (res && res.practitioner_hours) {
      isDirty = false;
      applyHoursToRuntime(res.practitioner_hours);
      if (res.header_schedule && res.header_schedule.opens && res.header_schedule.closes) {
        draftHeaderSchedule = {
          opens: res.header_schedule.opens,
          closes: res.header_schedule.closes,
        };
      }
      updateMetaTimestamp(res.updated_at, res.updated_by);
      refreshUI();
    }
  } catch (err) {
    refreshUI();
  }
}

export function initHorariosModule() {
  initHeaderScheduleSelects();
  refreshUI();

  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      const validation = validateHoursDraft(draftHours);
      if (!validation.isValid) {
        showStatusBanner("error", validation.errors);
        return;
      }

      btnSave.disabled = true;
      const originalText = btnSave.textContent;
      btnSave.textContent = "Guardando…";

      try {
        const res = await api("horarios.php", {
          method: "POST",
          body: JSON.stringify({
            practitioner_hours: validation.normalized,
            header_schedule: draftHeaderSchedule,
          }),
        });
        isDirty = false;
        applyHoursToRuntime(res.practitioner_hours || validation.normalized);
        if (res.header_schedule && res.header_schedule.opens && res.header_schedule.closes) {
          draftHeaderSchedule = {
            opens: res.header_schedule.opens,
            closes: res.header_schedule.closes,
          };
        }
        updateMetaTimestamp(res.updated_at, res.updated_by);
        refreshUI();
        showStatusBanner("success", ["✓ Horarios guardados y activos en la turnera Agendar, barra superior y Clara."]);
      } catch (err) {
        showStatusBanner("error", [err.message || "No se pudieron guardar los horarios."]);
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = originalText;
      }
    });
  }

  if (btnCopyClara) {
    btnCopyClara.addEventListener("click", async () => {
      const text = claraPreviewEl ? claraPreviewEl.textContent : buildClaraPreviewText(draftHours);
      try {
        await navigator.clipboard.writeText(text);
        const prev = btnCopyClara.textContent;
        btnCopyClara.textContent = "✓ Copiado al portapapeles";
        setTimeout(() => {
          btnCopyClara.textContent = prev;
        }, 2000);
      } catch (_) {
        dialogAlert("Copiá manualmente el texto del recuadro inferior.");
      }
    });
  }
}
