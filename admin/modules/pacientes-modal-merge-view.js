/**
 * Kinésica Admin - Vistas HTML para unificación manual de pacientes.
 */

import { escapeHtml } from "./dom.js?v=79";
import { formatDisplayPhone } from "./pacientes-format.js";
import { formatPatientName } from "./pacientes-name.js?v=2";
import { patientMissingPhone, isPlaceholderPhone } from "./pacientes-identifiers.js";

export function renderMergeCandidatesHtml(matches, headerTitle = "") {
  return `
    ${headerTitle ? `<div style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase; padding:6px 10px; background:#f8fafc; border-bottom:1px solid #e2e8f0; border-radius: 6px 6px 0 0;">${escapeHtml(headerTitle)}</div>` : ""}
    ${matches.map((m) => {
      const name = formatPatientName(m).display;
      const tel = patientMissingPhone(m) ? "⚠️ Sin teléfono" : formatDisplayPhone(m.telefono);
      const dni = m.dni ? `· DNI ${escapeHtml(m.dni)}` : "";
      return `
        <div class="merge-result-item" data-id="${m.id}" role="button" tabindex="0">
          <div>
            <div class="merge-result-name">${escapeHtml(name)}</div>
            <div class="merge-result-meta">
              <span>${escapeHtml(tel)}</span>
              ${dni ? `<span>${dni}</span>` : ""}
              <span>#${m.id}</span>
            </div>
          </div>
          <button type="button" class="btn light small" style="font-size:11.5px; padding:3px 8px; pointer-events:none;">Elegir</button>
        </div>
      `;
    }).join("")}
  `;
}

export function renderMergeSelectionHtml(paciente, selectedTarget) {
  const currentName = formatPatientName(paciente).display;
  const currentTel = patientMissingPhone(paciente) ? "⚠️ Sin teléfono" : formatDisplayPhone(paciente.telefono);
  const currentDni = paciente.dni ? `DNI: ${escapeHtml(paciente.dni)}` : "Sin DNI";

  const targetName = formatPatientName(selectedTarget).display;
  const targetTel = patientMissingPhone(selectedTarget) ? "⚠️ Sin teléfono" : formatDisplayPhone(selectedTarget.telefono);
  const targetDni = selectedTarget.dni ? `DNI: ${escapeHtml(selectedTarget.dni)}` : "Sin DNI";

  // Si el paciente actual no tiene teléfono y el seleccionado sí, recomendar el seleccionado como principal
  const defaultKeepSelected = isPlaceholderPhone(paciente.telefono) && !isPlaceholderPhone(selectedTarget.telefono);

  return `
    <div class="merge-compare-grid">
      <div class="merge-compare-card current">
        <div class="merge-compare-badge">Ficha actual (#${paciente.id})</div>
        <div class="merge-compare-name">${escapeHtml(currentName)}</div>
        <div class="merge-compare-detail">
          <div>📞 ${escapeHtml(currentTel)}</div>
          <div>🪪 ${currentDni}</div>
        </div>
      </div>
      <div class="merge-compare-card target">
        <div class="merge-compare-badge">Ficha a unificar (#${selectedTarget.id})</div>
        <div class="merge-compare-name">${escapeHtml(targetName)}</div>
        <div class="merge-compare-detail">
          <div>📞 ${escapeHtml(targetTel)}</div>
          <div>🪪 ${targetDni}</div>
        </div>
      </div>
    </div>

    <div class="merge-direction-choice">
      <div style="font-size:11.5px; font-weight:700; color:#334155; text-transform:uppercase;">
        ¿Cuál ficha querés conservar como principal?
      </div>
      <label class="merge-radio-label">
        <input type="radio" name="merge_target_pick" value="current" ${defaultKeepSelected ? "" : "checked"}>
        <div class="merge-radio-text">
          <span class="merge-radio-title">Conservar ficha actual #${paciente.id} (${escapeHtml(currentName)})</span>
          <span class="merge-radio-desc">Se transferirán aquí todos los turnos, fichas y notas de #${selectedTarget.id}.</span>
        </div>
      </label>
      <label class="merge-radio-label">
        <input type="radio" name="merge_target_pick" value="selected" ${defaultKeepSelected ? "checked" : ""}>
        <div class="merge-radio-text">
          <span class="merge-radio-title">Conservar la otra ficha #${selectedTarget.id} (${escapeHtml(targetName)})</span>
          <span class="merge-radio-desc">Se transferirán allí todos los turnos, fichas y notas de #${paciente.id}.</span>
        </div>
      </label>
    </div>

    <div class="merge-warning-alert">
      ⚠️ <strong>Atención:</strong> La ficha no conservada se eliminará definitivamente tras transferir todos sus datos (turnos, fichas clínicas, notas e historial). Esta acción no se puede deshacer.
    </div>

    <div class="merge-actions">
      <button type="button" class="btn light small" id="btn-cancel-merge-selection">Elegir otro</button>
      <button type="button" class="btn danger" id="btn-execute-merge">Unificar Fichas</button>
    </div>
  `;
}
