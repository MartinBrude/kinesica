/**
 * Kinésica Admin - Editor de Franjas Horarias por Profesional
 * Formulario interactivo para activar días, añadir 2ª franja y seleccionar rangos.
 */

import { escapeHtml } from "./dom.js?v=78";
import {
  DAYS,
  PROF_META,
  hmToMin,
  minToHm,
  validateHoursDraft,
  buildTimeOptions,
} from "./horarios-validator.js";
import {
  computeProfWeeklyStats,
  findNonCollidingDefaultRange,
} from "./horarios-timeline.js";

const START_TIME_OPTIONS = buildTimeOptions(8, 19);
const END_TIME_OPTIONS = buildTimeOptions(9, 20);
const HEADER_TIME_OPTIONS = buildTimeOptions(8, 20);

export function initHeaderScheduleSelects({
  selectHeaderOpens,
  selectHeaderCloses,
  draftHeaderSchedule,
  onScheduleChange,
}) {
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
    draftHeaderSchedule.opens = selectHeaderOpens.value;
    if (hmToMin(draftHeaderSchedule.closes) <= hmToMin(draftHeaderSchedule.opens)) {
      const nextMin = Math.min(20 * 60, hmToMin(draftHeaderSchedule.opens) + 60);
      draftHeaderSchedule.closes = minToHm(nextMin);
      selectHeaderCloses.value = draftHeaderSchedule.closes;
    }
    if (typeof onScheduleChange === "function") onScheduleChange();
  });

  selectHeaderCloses.addEventListener("change", () => {
    draftHeaderSchedule.closes = selectHeaderCloses.value;
    if (hmToMin(draftHeaderSchedule.closes) <= hmToMin(draftHeaderSchedule.opens)) {
      const prevMin = Math.max(8 * 60, hmToMin(draftHeaderSchedule.closes) - 60);
      draftHeaderSchedule.opens = minToHm(prevMin);
      selectHeaderOpens.value = draftHeaderSchedule.opens;
    }
    if (typeof onScheduleChange === "function") onScheduleChange();
  });
}

export function renderEditors({ editorsGridEl, draftHours, onDraftChange }) {
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
      <span class="horarios-prof-stats" data-prof-stats="${prof.id}">${escapeHtml(computeProfWeeklyStats(draftHours, prof.id))}</span>
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
        if (!draftHours[prof.id]) draftHours[prof.id] = {};
        if (checkbox.checked) {
          draftHours[prof.id][dow] = [findNonCollidingDefaultRange(draftHours, prof.id, dow)];
        } else {
          delete draftHours[prof.id][dow];
          delete draftHours[prof.id][String(dow)];
        }
        if (typeof onDraftChange === "function") onDraftChange();
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
            const nextStartMin = Math.min(18 * 60, Math.max(r0EndMin + 30, 15 * 60));
            const nextEndMin = Math.min(20 * 60, Math.max(nextStartMin + 60, 19 * 60));
            draftHours[prof.id][dow] = [
              ranges[0],
              { start: minToHm(nextStartMin), end: minToHm(nextEndMin) },
            ];
            if (typeof onDraftChange === "function") onDraftChange();
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
            const newStart = startSelect.value;
            let newEnd = endSelect.value;
            if (hmToMin(newEnd) - hmToMin(newStart) < 60) {
              newEnd = minToHm(Math.min(20 * 60, hmToMin(newStart) + 60));
            }
            draftHours[prof.id][dow][rIdx] = { start: newStart, end: newEnd };
            if (typeof onDraftChange === "function") onDraftChange();
          });

          endSelect.addEventListener("change", () => {
            draftHours[prof.id][dow][rIdx] = { start: startSelect.value, end: endSelect.value };
            if (typeof onDraftChange === "function") onDraftChange();
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
              draftHours[prof.id][dow].splice(rIdx, 1);
              if (typeof onDraftChange === "function") onDraftChange();
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
