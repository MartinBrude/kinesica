/**
 * Markup HTML del modal de paciente.
 */

import { escapeHtml } from "./dom.js?v=79";
import { patientHasReview } from "./pacientes.js";

export function buildPacienteModalMarkup({
  isEdit,
  isColaborador,
  nombreVal,
  apellidoVal,
  telVal,
  paciente,
  contactoNombreVal,
}) {
  const modalTitle = isColaborador ? "Datos del Paciente" : (isEdit ? "Editar Paciente" : "Nuevo Paciente");
  const readOnlyBanner = isColaborador
    ? '<div style="background:#fef3c7; color:#92400e; padding:10px 14px; border-radius:6px; margin-bottom:14px; font-size:13px; font-weight:500;">👁️ Modo solo lectura (Colaborador): Datos del paciente en modo de solo consulta.</div>'
    : '';

  return `
    <div class="paciente-modal-card">
      <div class="paciente-modal-header">
        <h2>${escapeHtml(modalTitle)}</h2>
        <button type="button" class="btn ghost btn-close-modal">✕</button>
      </div>
      <form id="form-full-paciente">
        <div class="paciente-modal-body">
          ${readOnlyBanner}
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="paciente-modal-field">
              <label>Nombre *</label>
              <input type="text" id="modal-p-nombre" value="${escapeHtml(nombreVal)}" placeholder="Ej: Florencia" maxlength="60" required autofocus>
            </div>
            <div class="paciente-modal-field">
              <label>Apellido *</label>
              <input type="text" id="modal-p-apellido" value="${escapeHtml(apellidoVal)}" placeholder="Ej: González" maxlength="60" required>
            </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="paciente-modal-field">
              <label>Teléfono (WhatsApp) *</label>
              <input type="tel" id="modal-p-tel" value="${escapeHtml(telVal)}" placeholder="Ej: 11 6123-4567 o +34..." maxlength="24" inputmode="tel" required>
              <small>Para WhatsApp y recordatorios automáticos.</small>
            </div>
            <div class="paciente-modal-field">
              <label>Email</label>
              <input type="email" id="modal-p-email" value="${escapeHtml(paciente?.email || "")}" placeholder="ejemplo@email.com" maxlength="120" inputmode="email" autocapitalize="off" spellcheck="false">
              <small>Para avisos y confirmaciones de turnos.</small>
            </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="paciente-modal-field">
              <label>DNI / Documento</label>
              <input type="text" id="modal-p-dni" value="${escapeHtml(paciente?.dni || "")}" placeholder="Opcional" maxlength="20">
            </div>
            <div class="paciente-modal-field">
              <label>Profesional Habitual</label>
              <select id="modal-p-prof">
                <option value="indistinto" ${paciente?.profesional_habitual === "indistinto" ? "selected" : ""}>Indistinto</option>
                <option value="norberto" ${paciente?.profesional_habitual === "norberto" ? "selected" : ""}>Norberto</option>
                <option value="maria" ${paciente?.profesional_habitual === "maria" ? "selected" : ""}>María</option>
              </select>
            </div>
          </div>
          <div class="paciente-modal-field">
            <label>Motivo de Consulta / Disciplina</label>
            <input type="text" id="modal-p-motivo" value="${escapeHtml(paciente?.motivo_consulta || "")}" placeholder="Ej: ATM, RPG, Cervicalgia, Lumbalgia" maxlength="255">
          </div>
          <div class="paciente-modal-field">
            <label>Notas Clínicas / Administrativas</label>
            <textarea id="modal-p-notas" rows="2" placeholder="Observaciones opcionales" maxlength="2000">${escapeHtml(paciente?.notas || "")}</textarea>
          </div>
          <div class="paciente-modal-field" style="margin-top: 10px; padding: 10px 12px; background: #fefce8; border: 1px solid #fef08a; border-radius: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13.5px; font-weight: 600; color: #854d0e; margin: 0;">
              <input type="checkbox" id="modal-p-dejo-review" ${patientHasReview(paciente) ? "checked" : ""}>
              <span>⭐ Ya dejó reseña en Google</span>
            </label>
            <small style="color: #a16207; display: block; margin-top: 3px; font-size: 11.5px;">Si está marcado, no se mostrará el botón "Pedir review" en la lista de pacientes.</small>
          </div>
          <div style="margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px; text-transform: uppercase;">
              👤 Contacto / Agendado por (opcional):
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px;">
              <div class="paciente-modal-field">
                <label>Nombre de quien agenda</label>
                <input type="text" id="modal-p-contacto-nombre" value="${escapeHtml(contactoNombreVal)}" placeholder="Ej: Laura Gómez (familiar / cónyuge / secretaria)" maxlength="120">
              </div>
              <div class="paciente-modal-field">
                <label>Teléfono de contacto (WhatsApp)</label>
                <input type="tel" id="modal-p-contacto-tel" value="${escapeHtml(paciente?.contacto_telefono || "")}" placeholder="Ej: 11 6123-4567 o +34..." maxlength="24" inputmode="tel">
              </div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="paciente-modal-field">
                <label>Email de contacto</label>
                <input type="email" id="modal-p-contacto-email" value="${escapeHtml(paciente?.contacto_email || "")}" placeholder="contacto@ejemplo.com" maxlength="120" inputmode="email" autocapitalize="off" spellcheck="false">
              </div>
              <div class="paciente-modal-field">
                <label>Relación o rol</label>
                <input type="text" id="modal-p-contacto-notas" value="${escapeHtml(paciente?.contacto_notas || "")}" placeholder="Ej: Cónyuge, Hijo/a, Secretaria" maxlength="100">
              </div>
            </div>
          </div>
          <p id="modal-p-error" style="color:#dc2626; font-size:13px; margin:0;" hidden></p>
        </div>
        <div class="paciente-modal-footer">
          <button type="button" class="btn light btn-close-modal">${isColaborador ? "Cerrar" : "Cancelar"}</button>
          ${isColaborador ? "" : `<button type="submit" class="btn green" id="btn-submit-paciente">${isEdit ? "Guardar Cambios" : "Crear Paciente"}</button>`}
        </div>
      </form>
    </div>
  `

}
