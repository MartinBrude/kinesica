/**
 * Kinésica Admin - Módulo de Configuración de Horarios por Profesional
 * Permite visualizar y editar los días y franjas de atención de María y Norberto,
 * validando la restricción de 1 sola camilla física y sincronizando con Agendar y Clara.
 */

import { api } from "./api.js?v=77";
import { escapeHtml, dialogAlert, switchActiveView } from "./dom.js?v=78";
import {
  DEFAULT_HEADER_SCHEDULE,
  DEFAULT_PRACTITIONER_HOURS,
  cloneHours,
  hmToMin,
  minToHm,
  formatHeaderScheduleText,
  validateHoursDraft,
  buildClaraPreviewText,
} from "./horarios-validator.js";
import { renderTimeline } from "./horarios-timeline.js";
import { renderEditors, initHeaderScheduleSelects } from "./horarios-editor.js";

export {
  DEFAULT_HEADER_SCHEDULE,
  DEFAULT_PRACTITIONER_HOURS,
  cloneHours,
  hmToMin,
  minToHm,
  formatHeaderScheduleText,
  validateHoursDraft,
  buildClaraPreviewText,
};

const getEl = (sel) => (typeof document !== "undefined" ? document.querySelector(sel) : null);
const timelineRowsEl = getEl("#horarios-timeline-rows");
const editorsGridEl = getEl("#horarios-editors-grid");
const statusBannerEl = getEl("#horarios-status-banner");
const lastUpdatedEl = getEl("#horarios-last-updated");
const claraPreviewEl = getEl("#horarios-clara-preview");
const btnSave = getEl("#btn-save-horarios");
const btnCopyClara = getEl("#btn-copy-clara-horarios");
const selectHeaderOpens = getEl("#select-header-schedule-opens");
const selectHeaderCloses = getEl("#select-header-schedule-closes");
const headerPreviewEl = getEl("#header-schedule-preview");

let draftHeaderSchedule = { ...DEFAULT_HEADER_SCHEDULE };
let draftHours = cloneHours(DEFAULT_PRACTITIONER_HOURS);
let isDirty = false;

export function applyHoursToRuntime(hoursObj) {
  if (!hoursObj) return;
  draftHours = cloneHours(hoursObj);
  if (typeof window !== "undefined" && window.KinesicaBookingEngine?.setPractitionerHours) {
    window.KinesicaBookingEngine.setPractitionerHours(hoursObj);
  }
  if (typeof window !== "undefined" && window.KinesicaBookingModal?.invalidateCache) {
    window.KinesicaBookingModal.invalidateCache();
  }
  try {
    const pub = JSON.parse(localStorage.getItem("kinesica_public_settings") || "{}") || {};
    pub.practitioner_hours = hoursObj;
    localStorage.setItem("kinesica_public_settings", JSON.stringify(pub));
  } catch (_) {}
}

export function showHorariosView() {
  switchActiveView("view-consultorio");
  try {
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "consultorio" }));
  } catch (_) {}
  loadHorariosFromServer();
}

export function hideHorariosView() {
  const view = document.getElementById("view-consultorio");
  if (view) view.hidden = true;
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

function refreshUI() {
  const validation = validateHoursDraft(draftHours);
  renderTimeline(timelineRowsEl, draftHours, validation);
  renderEditors({
    editorsGridEl,
    draftHours,
    onDraftChange: () => {
      isDirty = true;
      refreshUI();
    },
  });

  if (claraPreviewEl) claraPreviewEl.textContent = buildClaraPreviewText(draftHours);

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

  if (btnSave) btnSave.disabled = !validation.isValid;

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
      if (res.header_schedule?.opens && res.header_schedule?.closes) {
        draftHeaderSchedule = {
          opens: res.header_schedule.opens,
          closes: res.header_schedule.closes,
        };
      }
      updateMetaTimestamp(res.updated_at, res.updated_by);
      refreshUI();
    }
  } catch {
    refreshUI();
  }
}

export function initHorariosModule() {
  initHeaderScheduleSelects({
    selectHeaderOpens,
    selectHeaderCloses,
    draftHeaderSchedule,
    onScheduleChange: () => {
      isDirty = true;
      refreshUI();
    },
  });
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
        if (res.header_schedule?.opens && res.header_schedule?.closes) {
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
        setTimeout(() => { btnCopyClara.textContent = prev; }, 2000);
      } catch (_) {
        dialogAlert("Copiá manualmente el texto del recuadro inferior.");
      }
    });
  }
}
