/**
 * Kinésica Admin - UI para Formulario de Cesión de Horarios y Cierres
 * Permite seleccionar día puntual o rango, franja(s) horaria(s) y asignación.
 */

import { escapeHtml } from "./dom.js?v=79";
import { validateCesionDraft } from "./horarios-cesiones-validator.js?v=79";
import { buildCesionFormHtml, buildHourOptions } from "./horarios-cesiones-form-html.js?v=1";
export { getOverrideStatusBadge, formatOverrideDescription, renderCesionesList } from "./horarios-cesiones-list.js?v=79";

function buildDraftFromForm({ isClosure, targetValue, periodType, sDate, eDate, timeScope, franjas, onLeave, reason }) {
  const isCustom = timeScope === "custom_hours";
  return {
    action: isClosure ? "closure" : "transfer",
    from_practitioner: isClosure ? null : (targetValue === "to_maria" ? "norberto" : "maria"),
    to_practitioner: isClosure ? null : (targetValue === "to_maria" ? "maria" : "norberto"),
    period_type: periodType,
    start_date: sDate,
    end_date: eDate,
    time_scope: timeScope,
    custom_ranges: isCustom ? franjas.slice() : [],
    custom_range: isCustom && franjas.length > 0 ? franjas[0] : null,
    practitioner_on_leave: Boolean(onLeave),
    ...(reason !== undefined ? { reason } : {}),
  };
}

export function renderCesionesForm({ container, onSubmit, onCheckConflicts }) {
  if (!container) return;
  const today = new Date().toISOString().split("T")[0];
  let franjas = [{ start: "14:00", end: "17:00" }];

  container.innerHTML = buildCesionFormHtml(today);

  const form = container.querySelector("#form-horarios-cesion");
  const targetSel = container.querySelector("#cesion-target-flow");
  const periodSel = container.querySelector("#cesion-period-type");
  const sDateInput = container.querySelector("#cesion-start-date");
  const eDateInput = container.querySelector("#cesion-end-date");
  const lblStart = container.querySelector("#lbl-cesion-start");
  const endDateWrapper = container.querySelector("#wrapper-cesion-end-date");
  const timeScopeSel = container.querySelector("#cesion-time-scope");
  const customHoursWrapper = container.querySelector("#wrapper-cesion-custom-hours");
  const onLeaveWrapper = container.querySelector("#wrapper-cesion-on-leave");
  const onLeaveInput = container.querySelector("#cesion-on-leave");
  const franjasListEl = container.querySelector("#cesion-franjas-list");
  const btnAddFranja = container.querySelector("#btn-add-franja");
  const banner = container.querySelector("#cesion-conflicts-banner");
  const preview = container.querySelector("#cesion-preview-banner");
  const btnSave = container.querySelector("#btn-save-cesion");

  const renderFranjaRows = () => {
    franjasListEl.innerHTML = franjas.map((f, idx) => `
      <div class="franja-row" data-idx="${idx}" style="display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
        <span style="font-size:12px; font-weight:600; min-width:62px; color:#475569;">Franja ${idx + 1}:</span>
        <label style="font-size:12px; color:#475569;">Desde</label>
        <select class="franja-start" style="height:32px; border:1px solid var(--line); border-radius:4px; padding:0 6px; font-size:13px;">
          ${buildHourOptions(f.start)}
        </select>
        <label style="font-size:12px; color:#475569;">Hasta</label>
        <select class="franja-end" style="height:32px; border:1px solid var(--line); border-radius:4px; padding:0 6px; font-size:13px;">
          ${buildHourOptions(f.end)}
        </select>
        ${franjas.length > 1 ? `<button type="button" class="btn-remove-franja btn ghost small" data-remove="${idx}" style="color:#ef4444; padding:2px 8px; font-weight:bold;" title="Quitar franja">✕</button>` : ""}
      </div>
    `).join("");

    franjasListEl.querySelectorAll(".franja-start").forEach((sel, i) => {
      sel.addEventListener("change", (e) => { franjas[i].start = e.target.value; updatePreviewAndConflicts(); });
    });
    franjasListEl.querySelectorAll(".franja-end").forEach((sel, i) => {
      sel.addEventListener("change", (e) => { franjas[i].end = e.target.value; updatePreviewAndConflicts(); });
    });
    franjasListEl.querySelectorAll(".btn-remove-franja").forEach((btn) => {
      btn.addEventListener("click", () => {
        franjas.splice(Number(btn.getAttribute("data-remove")), 1);
        renderFranjaRows();
        updatePreviewAndConflicts();
      });
    });
  };

  btnAddFranja.addEventListener("click", () => {
    const lastEnd = franjas[franjas.length - 1]?.end || "17:00";
    franjas.push({ start: lastEnd, end: "20:00" });
    renderFranjaRows();
    updatePreviewAndConflicts();
  });
  renderFranjaRows();

  const updatePreviewAndConflicts = () => {
    const isRange = periodSel.value === "date_range";
    lblStart.textContent = isRange ? "Desde fecha" : "Fecha";
    endDateWrapper.style.display = isRange ? "block" : "none";
    const isCustom = timeScopeSel.value === "custom_hours";
    customHoursWrapper.style.display = isCustom ? "block" : "none";
    const isClosure = targetSel.value === "closure";
    const showOnLeave = isRange && !isClosure;
    if (onLeaveWrapper) onLeaveWrapper.style.display = showOnLeave ? "block" : "none";
    if (!showOnLeave && onLeaveInput) onLeaveInput.checked = false;
    const onLeave = Boolean(showOnLeave && onLeaveInput && onLeaveInput.checked);

    const sDate = String(sDateInput.value || "").trim();
    const eDate = isRange ? String(eDateInput.value || "").trim() : sDate;

    if (!sDate) {
      if (btnSave) btnSave.disabled = true;
      preview.innerHTML = "ℹ️ <em>Seleccioná una fecha para ver el resumen y programar la excepción.</em>";
      banner.style.display = "none";
      return;
    }
    if (isRange && !eDate) {
      if (btnSave) btnSave.disabled = true;
      preview.innerHTML = "ℹ️ <em>Seleccioná la fecha de finalización del rango.</em>";
      banner.style.display = "none";
      return;
    }

    const draft = buildDraftFromForm({
      isClosure,
      targetValue: targetSel.value,
      periodType: periodSel.value,
      sDate,
      eDate,
      timeScope: timeScopeSel.value,
      franjas,
      onLeave,
    });

    const validation = validateCesionDraft(draft);
    if (!validation.isValid) {
      if (btnSave) btnSave.disabled = true;
      preview.innerHTML = `⚠️ <strong>Revisá los datos:</strong> ${escapeHtml(validation.errors[0])}`;
      banner.style.display = "none";
      return;
    }

    if (btnSave) btnSave.disabled = false;

    const dateText = isRange ? (sDate === eDate ? `el día ${sDate}` : `el rango del ${sDate} al ${eDate}`) : `el día ${sDate}`;
    const hoursText = isCustom
      ? franjas.map((f) => `de ${f.start} a ${f.end} hs`).join(" y ")
      : "durante la jornada completa";
    let targetText = "el consultorio estará CERRADO para ambos profesionales";
    if (targetSel.value === "to_maria") targetText = "los turnos pasan a estar disponibles para María liberada por Norberto";
    if (targetSel.value === "to_norberto") targetText = "los turnos pasan a estar disponibles para Norberto liberado por María";
    const leaveText = onLeave
      ? " Además, quien cede queda de baja: Agendar no ofrecerá disciplinas que solo esa persona atiende."
      : "";
    preview.innerHTML = `📌 <strong>Resumen:</strong> Para ${escapeHtml(dateText)}, ${escapeHtml(hoursText)}, ${escapeHtml(targetText)}.${escapeHtml(leaveText)}`;

    if (typeof onCheckConflicts !== "function" || isClosure) {
      banner.style.display = "none";
      return;
    }
    const cedingId = targetSel.value === "to_maria" ? "norberto" : "maria";
    onCheckConflicts({ startDate: sDate, endDate: eDate, practitionerId: cedingId }).then((conflicts) => {
      if (conflicts && conflicts.length > 0) {
        banner.style.display = "block";
        banner.style.background = "#eff6ff";
        banner.style.border = "1px solid #bfdbfe";
        banner.style.color = "#1e40af";
        banner.innerHTML = `ℹ️ <strong>Atención:</strong> Hay ${conflicts.length} turno(s) agendado(s) de antemano. Los turnos ya reservados se respetan y no se ceden: el sistema habilitará automáticamente los horarios libres restantes.`;
      } else {
        banner.style.display = "none";
      }
    });
  };

  [targetSel, periodSel, sDateInput, eDateInput, timeScopeSel, onLeaveInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", updatePreviewAndConflicts);
    el.addEventListener("input", updatePreviewAndConflicts);
  });
  updatePreviewAndConflicts();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const isClosure = targetSel.value === "closure";
    const isRange = periodSel.value === "date_range";
    const onLeave = Boolean(isRange && !isClosure && onLeaveInput && onLeaveInput.checked);
    const draft = buildDraftFromForm({
      isClosure,
      targetValue: targetSel.value,
      periodType: periodSel.value,
      sDate: sDateInput.value,
      eDate: periodSel.value === "single_day" ? sDateInput.value : eDateInput.value,
      timeScope: timeScopeSel.value,
      franjas,
      onLeave,
      reason: container.querySelector("#cesion-reason").value.trim(),
    });
    if (typeof onSubmit === "function") onSubmit(draft);
  });
}
