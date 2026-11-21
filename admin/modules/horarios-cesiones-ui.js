/**
 * Kinésica Admin - UI para Formulario de Cesión de Horarios y Cierres
 * Permite seleccionar día puntual o rango, franja(s) horaria(s) y asignación.
 */

import { escapeHtml } from "./dom.js?v=79";
import { validateCesionDraft } from "./horarios-cesiones-validator.js?v=79";
export { getOverrideStatusBadge, formatOverrideDescription, renderCesionesList } from "./horarios-cesiones-list.js?v=79";

function buildHourOptions(selected) {
  const opts = [];
  for (let h = 8; h <= 20; h++) {
    for (const m of ["00", "30"]) {
      if (h === 20 && m === "30") continue;
      const val = `${String(h).padStart(2, "0")}:${m}`;
      opts.push(`<option value="${val}" ${val === selected ? "selected" : ""}>${val} hs</option>`);
    }
  }
  return opts.join("");
}

export function renderCesionesForm({ container, onSubmit, onCheckConflicts }) {
  if (!container) return;
  const today = new Date().toISOString().split("T")[0];
  let franjas = [{ start: "14:00", end: "17:00" }];

  container.innerHTML = `
    <div class="cesiones-form-card" style="background:#fff; border:1px solid var(--line); border-radius:8px; padding:20px; margin-bottom:24px;">
      <h3 style="margin-top:0; margin-bottom:14px; font-size:16px; color:var(--navy);">Programar Excepción: Cesión de Horarios o Cierre</h3>
      <form id="form-horarios-cesion">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap:14px; margin-bottom:14px;">
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">1. ¿Para quién pasan a estar disponibles?</label>
            <select id="cesion-target-flow" style="width:100%; height:38px; border:1px solid var(--line); border-radius:6px; padding:0 8px;">
              <option value="to_maria">Disponibles para María (liberada por Norberto)</option>
              <option value="to_norberto">Disponibles para Norberto (liberado por María)</option>
              <option value="closure">Cierre total de consultorio (bloqueo para ambos)</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">2. Período de fechas</label>
            <select id="cesion-period-type" style="width:100%; height:38px; border:1px solid var(--line); border-radius:6px; padding:0 8px;">
              <option value="single_day">Día puntual</option>
              <option value="date_range">Rango de fechas</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap:14px; margin-bottom:14px;">
          <div>
            <label id="lbl-cesion-start" style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Fecha</label>
            <input type="date" id="cesion-start-date" value="" min="${today}" style="width:100%; height:38px; border:1px solid var(--line); border-radius:6px; padding:0 8px;">
          </div>
          <div id="wrapper-cesion-end-date" style="display:none;">
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Hasta fecha</label>
            <input type="date" id="cesion-end-date" value="" min="${today}" style="width:100%; height:38px; border:1px solid var(--line); border-radius:6px; padding:0 8px;">
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">3. Alcance horario</label>
            <select id="cesion-time-scope" style="width:100%; height:38px; border:1px solid var(--line); border-radius:6px; padding:0 8px;">
              <option value="all_day">Jornada completa</option>
              <option value="custom_hours">Franja horaria</option>
            </select>
          </div>
        </div>

        <div id="wrapper-cesion-custom-hours" style="display:none; margin-bottom:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px 14px;">
          <div style="font-size:13px; font-weight:600; color:var(--navy); margin-bottom:8px;">Franjas horarias a habilitar:</div>
          <div id="cesion-franjas-list"></div>
          <button type="button" class="btn light small" id="btn-add-franja" style="margin-top:6px; font-size:12px;">+ Agregar otra franja horaria</button>
        </div>

        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Motivo o nota interna (opcional)</label>
          <input type="text" id="cesion-reason" placeholder="Ej. Congreso médico, día libre acordado, refacción" maxlength="200" style="width:100%; height:38px; border:1px solid var(--line); border-radius:6px; padding:0 8px;">
        </div>

        <div id="cesion-preview-banner" style="margin-bottom:14px; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; color:#334155;"></div>
        <div id="cesion-conflicts-banner" style="display:none; margin-bottom:14px; padding:10px 14px; border-radius:6px; font-size:13px; line-height:1.4;"></div>

        <div style="display:flex; justify-content:flex-end;">
          <button type="submit" class="btn green" id="btn-save-cesion" disabled>Guardar y habilitar turnos</button>
        </div>
      </form>
    </div>
  `;

  const form = container.querySelector("#form-horarios-cesion");
  const targetSel = container.querySelector("#cesion-target-flow");
  const periodSel = container.querySelector("#cesion-period-type");
  const sDateInput = container.querySelector("#cesion-start-date");
  const eDateInput = container.querySelector("#cesion-end-date");
  const lblStart = container.querySelector("#lbl-cesion-start");
  const endDateWrapper = container.querySelector("#wrapper-cesion-end-date");
  const timeScopeSel = container.querySelector("#cesion-time-scope");
  const customHoursWrapper = container.querySelector("#wrapper-cesion-custom-hours");
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
        const removeIdx = Number(btn.getAttribute("data-remove"));
        franjas.splice(removeIdx, 1);
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

    const isClosure = targetSel.value === "closure";
    const draft = {
      action: isClosure ? "closure" : "transfer",
      from_practitioner: isClosure ? null : (targetSel.value === "to_maria" ? "norberto" : "maria"),
      to_practitioner: isClosure ? null : (targetSel.value === "to_maria" ? "maria" : "norberto"),
      period_type: periodSel.value,
      start_date: sDate,
      end_date: eDate,
      time_scope: timeScopeSel.value,
      custom_ranges: isCustom ? franjas.slice() : [],
      custom_range: isCustom && franjas.length > 0 ? franjas[0] : null,
    };

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
    preview.innerHTML = `📌 <strong>Resumen:</strong> Para ${escapeHtml(dateText)}, ${escapeHtml(hoursText)}, ${escapeHtml(targetText)}.`;

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

  [targetSel, periodSel, sDateInput, eDateInput, timeScopeSel].forEach((el) => {
    el.addEventListener("change", updatePreviewAndConflicts);
    el.addEventListener("input", updatePreviewAndConflicts);
  });
  updatePreviewAndConflicts();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const isClosure = targetSel.value === "closure";
    const isCustom = timeScopeSel.value === "custom_hours";
    const draft = {
      action: isClosure ? "closure" : "transfer",
      from_practitioner: isClosure ? null : (targetSel.value === "to_maria" ? "norberto" : "maria"),
      to_practitioner: isClosure ? null : (targetSel.value === "to_maria" ? "maria" : "norberto"),
      period_type: periodSel.value,
      start_date: sDateInput.value,
      end_date: periodSel.value === "single_day" ? sDateInput.value : eDateInput.value,
      time_scope: timeScopeSel.value,
      custom_ranges: isCustom ? franjas.slice() : [],
      custom_range: isCustom && franjas.length > 0 ? franjas[0] : null,
      reason: container.querySelector("#cesion-reason").value.trim(),
    };
    if (typeof onSubmit === "function") onSubmit(draft);
  });
}
