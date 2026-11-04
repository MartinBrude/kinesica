/**
 * Kinésica Admin - Modal de Alta y Edición de Pacientes
 * Diálogo accesible con validación estricta de teléfono E.164, email y sugerencia de dominios.
 */

import { api } from "./api.js?v=77";
import { escapeHtml } from "./dom.js?v=78";
import { getSessionUser } from "./auth.js?v=81";
import {
  isValidAdminEmail,
  suggestAdminEmailDomain,
  inspectAdminPhone,
} from "./pacientes-format.js";
import { patientHasReview } from "./pacientes.js";
import { sanitizePersonName, hasDisallowedNameChars } from "../ficha-rules.mjs?v=91";

export function openFullPacienteModal(paciente = null, onReload = null) {
  const isEdit = Boolean(paciente);
  const isColaborador = getSessionUser()?.role === "colaborador";
  const backdrop = document.createElement("div");
  backdrop.className = "paciente-modal-backdrop";

  let nombreVal = paciente?.nombre || "";
  let apellidoVal = paciente?.apellido || "";
  if (!nombreVal && !apellidoVal && paciente?.nombre_completo) {
    const parts = paciente.nombre_completo.trim().split(/\s+/);
    nombreVal = parts[0] || "";
    apellidoVal = parts.slice(1).join(" ") || "";
  }

  let telVal = paciente?.telefono || "";
  if (telVal.startsWith("sin-tel-") || telVal.startsWith("sin-telefono-") || telVal.startsWith("ficha-")) {
    telVal = "";
  }

  const modalTitle = isColaborador ? "Datos del Paciente" : (isEdit ? "Editar Paciente" : "Nuevo Paciente");
  const readOnlyBanner = isColaborador
    ? '<div style="background:#fef3c7; color:#92400e; padding:10px 14px; border-radius:6px; margin-bottom:14px; font-size:13px; font-weight:500;">👁️ Modo solo lectura (Colaborador): Datos del paciente en modo de solo consulta.</div>'
    : '';

  backdrop.innerHTML = `
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
                <input type="text" id="modal-p-contacto-nombre" value="${escapeHtml(paciente?.contacto_nombre || "")}" placeholder="Ej: Laura Gómez (familiar / cónyuge / secretaria)" maxlength="120">
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
  `;

  document.body.append(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelectorAll(".btn-close-modal").forEach((b) => b.addEventListener("click", close));

  if (isColaborador) {
    backdrop.querySelectorAll("input, textarea, select").forEach((el) => {
      el.disabled = true;
    });
  }

  const form = backdrop.querySelector("#form-full-paciente");
  const errorEl = backdrop.querySelector("#modal-p-error");
  const submitBtn = backdrop.querySelector("#btn-submit-paciente");
  const confirmedWeirdPhones = new Set();
  const confirmedSuspiciousEmails = new Set();

  ["#modal-p-nombre", "#modal-p-apellido", "#modal-p-contacto-nombre"].forEach((sel) => {
    const el = backdrop.querySelector(sel);
    if (el) {
      el.addEventListener("input", () => {
        const cleaned = sanitizePersonName(el.value);
        if (cleaned !== el.value) {
          el.value = cleaned;
        }
        errorEl.hidden = true;
      });
    }
  });

  ["#modal-p-tel", "#modal-p-contacto-tel"].forEach((sel) => {
    const el = backdrop.querySelector(sel);
    if (el) el.addEventListener("input", () => {
      const cleaned = el.value.replace(/[^0-9+\-().\s]/g, "");
      const hasPlus = cleaned.trimStart().startsWith("+");
      const noPlus = cleaned.replace(/\+/g, "");
      el.value = (hasPlus ? "+" + noPlus : noPlus).slice(0, 24);
      errorEl.hidden = true;
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rawNombre = backdrop.querySelector("#modal-p-nombre").value;
    const rawApellido = backdrop.querySelector("#modal-p-apellido").value;
    const rawContactoNombre = backdrop.querySelector("#modal-p-contacto-nombre")?.value || "";

    if (hasDisallowedNameChars(rawNombre) || hasDisallowedNameChars(rawApellido) || hasDisallowedNameChars(rawContactoNombre)) {
      errorEl.textContent = "El nombre y apellido no permiten comas, emojis ni saltos de línea.";
      errorEl.hidden = false;
      return;
    }

    const nombre = sanitizePersonName(rawNombre);
    const apellido = sanitizePersonName(rawApellido);
    const tel = backdrop.querySelector("#modal-p-tel").value.trim();
    const email = backdrop.querySelector("#modal-p-email").value.trim();
    const dni = backdrop.querySelector("#modal-p-dni").value.trim();
    const prof = backdrop.querySelector("#modal-p-prof").value;
    const motivo = backdrop.querySelector("#modal-p-motivo").value.trim();
    const notas = backdrop.querySelector("#modal-p-notas").value.trim();
    const contactoNombre = sanitizePersonName(rawContactoNombre);
    const contactoTel = backdrop.querySelector("#modal-p-contacto-tel")?.value.trim() || "";
    const contactoEmail = backdrop.querySelector("#modal-p-contacto-email")?.value.trim() || "";
    const contactoNotas = backdrop.querySelector("#modal-p-contacto-notas")?.value.trim() || "";
    const dejoReview = backdrop.querySelector("#modal-p-dejo-review")?.checked ? 1 : 0;

    if (!nombre || !apellido || !tel) {
      errorEl.textContent = "Nombre, apellido y teléfono son obligatorios.";
      errorEl.hidden = false;
      return;
    }
    if (!isValidAdminEmail(email)) {
      errorEl.textContent = "El correo electrónico ingresado no tiene un formato válido.";
      errorEl.hidden = false;
      return;
    }
    if (email) {
      const eLower = email.toLowerCase();
      const suggested = suggestAdminEmailDomain(eLower);
      if (suggested && !confirmedSuspiciousEmails.has(eLower)) {
        confirmedSuspiciousEmails.add(eLower);
        errorEl.textContent = `¿El correo (${email}) es correcto? Quizás quisiste escribir @${suggested}. Si está bien, volvé a tocar Guardar.`;
        errorEl.hidden = false;
        return;
      }
    }
    if (!isValidAdminEmail(contactoEmail)) {
      errorEl.textContent = "El correo electrónico de contacto no tiene un formato válido.";
      errorEl.hidden = false;
      return;
    }
    const telInfo = inspectAdminPhone(tel);
    if (!telInfo.valid) {
      errorEl.textContent = "Por favor ingresá un número de teléfono válido.";
      errorEl.hidden = false;
      return;
    }
    if (!telInfo.standard && !confirmedWeirdPhones.has(telInfo.digits)) {
      confirmedWeirdPhones.add(telInfo.digits);
      errorEl.textContent = "¿El teléfono es correcto? Si es de otro país o ya lo revisaste, volvé a tocar Guardar para confirmar.";
      errorEl.hidden = false;
      return;
    }
    if (contactoTel) {
      const cTelInfo = inspectAdminPhone(contactoTel);
      if (!cTelInfo.valid) {
        errorEl.textContent = "El teléfono de contacto no es válido.";
        errorEl.hidden = false;
        return;
      }
    }

    const nombreCompleto = `${nombre} ${apellido}`.trim();
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando…";
    errorEl.hidden = true;

    try {
      const payload = {
        nombre,
        apellido,
        nombre_completo: nombreCompleto,
        telefono: tel,
        email,
        dni,
        profesional_habitual: prof,
        motivo_consulta: motivo,
        notas,
        contacto_nombre: contactoNombre,
        contacto_telefono: contactoTel,
        contacto_email: contactoEmail,
        contacto_notas: contactoNotas,
        dejo_review: dejoReview,
      };
      if (isEdit) {
        await api("pacientes.php", { method: "PUT", body: JSON.stringify({ id: paciente.id, ...payload }) });
      } else {
        await api("pacientes.php", { method: "POST", body: JSON.stringify({ action: "insert", origen: "admin", ...payload }) });
      }
      close();
      if (typeof onReload === "function") await onReload();
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? "Guardar Cambios" : "Crear Paciente";
      errorEl.textContent = err.message || "Error al procesar la solicitud";
      errorEl.hidden = false;
    }
  });
}
