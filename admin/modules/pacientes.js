/**
 * Kinésica Admin - Módulo de Gestión de Pacientes y Directorio de Teléfonos
 * Permite buscar, ver, dar de alta y editar teléfonos para WhatsApp y recordatorios.
 */

import { api } from "./api.js?v=77";
import { escapeHtml, node, debounce, dialogAlert, dialogConfirm } from "./dom.js?v=78";

const viewPacientes = document.querySelector("#view-pacientes");
const listEl = document.querySelector("#pacientes-list-tbody");
const searchInput = document.querySelector("#search-pacientes");
const profFilter = document.querySelector("#filter-pacientes-prof");
const btnNuevo = document.querySelector("#btn-nuevo-paciente");
const btnBackupSql = document.querySelector("#btn-backup-sql");
const countEl = document.querySelector("#pacientes-total-count");

let pacientesCache = [];
let activeFilterProf = "todos";

/**
 * Formatea un número de teléfono para lectura clara (ej: 5491161164311 -> (+54) 9 11 6116 4311)
 * @param {string} raw
 * @returns {string}
 */
export function formatDisplayPhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return raw;

  // Argentina: 549 + código de área + número local (ej: 5491161164311 -> (+54) 9 11 6116 4311)
  if (digits.startsWith("549")) {
    const rest = digits.slice(3); // ej: "1161164311"
    if (rest.startsWith("11") && rest.length === 10) {
      return `(+54) 9 11 ${rest.slice(2, 6)} ${rest.slice(6)}`;
    }
    if (rest.length === 10) {
      return `(+54) 9 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
    }
    if (rest.length >= 8) {
      const p1 = rest.slice(rest.length - 8, rest.length - 4);
      const p2 = rest.slice(rest.length - 4);
      const area = rest.slice(0, rest.length - 8);
      return `(+54) 9 ${area} ${p1} ${p2}`;
    }
    return `(+54) 9 ${rest}`;
  }

  // Argentina sin 9 intermedio (ej: 5411...)
  if (digits.startsWith("54") && digits.length >= 10) {
    const rest = digits.slice(2);
    if (rest.startsWith("11") && rest.length === 10) {
      return `(+54) 11 ${rest.slice(2, 6)} ${rest.slice(6)}`;
    }
    return `(+54) ${rest}`;
  }

  // España: 34 + 9 dígitos (ej: 34612345678 -> (+34) 612 345 678)
  if (digits.startsWith("34") && digits.length === 11) {
    const rest = digits.slice(2);
    return `(+34) ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }

  // Local 10 dígitos (ej: 1161164311)
  if (digits.startsWith("11") && digits.length === 10) {
    return `11 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }

  return `+${digits}`;
}

export function showPacientesView() {
  if (viewPacientes) {
    viewPacientes.hidden = false;
    // Ocultar otras vistas
    const views = ["#view-dashboard", "#view-library", "#view-horarios", "#view-form", "#view-compare", "#view-gate"];
    views.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.hidden = true;
    });
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "pacientes" }));
    } catch {}
    loadPacientes();
  }
}

export function hidePacientesView() {
  if (viewPacientes) {
    viewPacientes.hidden = true;
  }
}

export async function loadPacientes() {
  if (!listEl) return;
  listEl.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--muted);">Cargando directorio de pacientes…</td></tr>`;
  try {
    const res = await api("pacientes.php");
    pacientesCache = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
    renderPacientesTable();
  } catch (err) {
    listEl.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: #dc2626;">Error al cargar pacientes: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function filterPacientes() {
  const query = (searchInput?.value || "").toLowerCase().trim();
  return pacientesCache.filter((p) => {
    if (activeFilterProf !== "todos" && p.profesional_habitual !== activeFilterProf) {
      return false;
    }
    if (!query) return true;
    const nameMatch = (p.nombre_completo || "").toLowerCase().includes(query) ||
                      (p.nombre || "").toLowerCase().includes(query) ||
                      (p.apellido || "").toLowerCase().includes(query);
    const phoneMatch = (p.telefono || "").includes(query);
    const emailMatch = (p.email || "").toLowerCase().includes(query);
    const dniMatch = (p.dni || "").toLowerCase().includes(query);
    const motivoMatch = (p.motivo_consulta || "").toLowerCase().includes(query);
    const contactMatch = (p.contacto_nombre || "").toLowerCase().includes(query) ||
                         (p.contacto_telefono || "").includes(query) ||
                         (p.contacto_notas || "").toLowerCase().includes(query);
    return nameMatch || phoneMatch || emailMatch || dniMatch || motivoMatch || contactMatch;
  });
}

export function renderPacientesTable() {
  if (!listEl) return;
  const filtered = filterPacientes();

  if (countEl) {
    countEl.textContent = `${filtered.length} paciente${filtered.length === 1 ? "" : "s"}`;
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 32px; color: var(--muted);">No se encontraron pacientes que coincidan con la búsqueda.</td></tr>`;
    return;
  }

  listEl.innerHTML = "";
  filtered.forEach((p) => {
    const tr = document.createElement("tr");

    // Nombre completo para mostrar como texto único
    const fullName = p.nombre_completo || [p.nombre, p.apellido].filter(Boolean).join(" ") || "Paciente";

    // Badge si fue agendado por un tercero o tiene familiar/secretaria asociada
    const contactBadge = (p.contacto_nombre || p.contacto_telefono)
      ? `<div style="font-size: 11px; color: #475569; margin-top: 3px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; display: inline-block;">
           👤 Contacto / Agendó: <strong>${escapeHtml(p.contacto_nombre || "Familiar")}</strong>${p.contacto_telefono ? ` (${escapeHtml(formatDisplayPhone(p.contacto_telefono))})` : ""}${p.contacto_notas ? ` • ${escapeHtml(p.contacto_notas)}` : ""}
         </div>`
      : "";

    // Teléfono formateado para lectura y link a WhatsApp
    const rawTel = p.telefono || "";
    const waLink = rawTel ? `https://wa.me/${rawTel}` : "#";
    const displayTel = formatDisplayPhone(rawTel);

    tr.innerHTML = `
      <td>
        <strong style="color: var(--navy);">${escapeHtml(fullName)}</strong>
        ${contactBadge}
      </td>
      <td>
        <div class="phone-cell">
          ${rawTel ? `<a class="phone-link" href="${waLink}" target="_blank" rel="noopener" title="Abrir chat de WhatsApp">📲 ${escapeHtml(displayTel)}</a>` : '<span style="color:var(--muted)">Sin teléfono</span>'}
        </div>
      </td>
      <td>
        ${p.email ? `<a class="email-link" href="mailto:${escapeHtml(p.email)}" title="Enviar correo a ${escapeHtml(p.email)}">✉️ ${escapeHtml(p.email)}</a>` : '<span style="color:var(--muted)">—</span>'}
      </td>
      <td>${p.dni ? escapeHtml(p.dni) : '<span style="color:var(--muted)">—</span>'}</td>
      <td>
        <span class="badge-prof ${escapeHtml(p.profesional_habitual || "indistinto")}">
          ${escapeHtml(p.profesional_habitual || "indistinto")}
        </span>
      </td>
      <td><small>${p.motivo_consulta ? escapeHtml(p.motivo_consulta) : "—"}</small></td>
      <td style="text-align: right;">
        <div class="pacientes-actions">
          <button type="button" class="btn light btn-edit-paciente" data-id="${p.id}" title="Editar paciente">Editar</button>
          <button type="button" class="btn ghost btn-delete-paciente btn-icon-del" data-id="${p.id}" data-name="${escapeHtml(fullName)}" title="Eliminar paciente" aria-label="Eliminar paciente">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </td>
    `;
    listEl.append(tr);
  });

  // Event Listeners para acciones en filas

  listEl.querySelectorAll(".btn-edit-paciente").forEach((btn) => {
    btn.addEventListener("click", () => {
      const paciente = pacientesCache.find((p) => String(p.id) === String(btn.dataset.id));
      if (paciente) openFullPacienteModal(paciente);
    });
  });

  listEl.querySelectorAll(".btn-delete-paciente").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmed = await dialogConfirm(
        `¿Confirmás que querés eliminar al paciente "${btn.dataset.name}" del directorio?`,
        "Eliminar",
        "Cancelar",
        true
      );
      if (confirmed) {
        try {
          await api(`pacientes.php?id=${btn.dataset.id}`, { method: "DELETE" });
          pacientesCache = pacientesCache.filter((p) => String(p.id) !== String(btn.dataset.id));
          renderPacientesTable();
        } catch (err) {
          dialogAlert(`No se pudo eliminar el paciente: ${err.message}`);
        }
      }
    });
  });
}



// Modal de alta o edición completa de paciente
function openFullPacienteModal(paciente = null) {
  const isEdit = Boolean(paciente);
  const backdrop = document.createElement("div");
  backdrop.className = "paciente-modal-backdrop";

  // Desglosar nombre y apellido si ya vienen separados o juntos
  let nombreVal = paciente?.nombre || "";
  let apellidoVal = paciente?.apellido || "";
  if (!nombreVal && !apellidoVal && paciente?.nombre_completo) {
    const parts = paciente.nombre_completo.trim().split(/\s+/);
    nombreVal = parts[0] || "";
    apellidoVal = parts.slice(1).join(" ") || "";
  }

  backdrop.innerHTML = `
    <div class="paciente-modal-card">
      <div class="paciente-modal-header">
        <h2>${isEdit ? "Editar Paciente" : "Nuevo Paciente"}</h2>
        <button type="button" class="btn ghost btn-close-modal">✕</button>
      </div>
      <form id="form-full-paciente">
        <div class="paciente-modal-body">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="paciente-modal-field">
              <label>Nombre *</label>
              <input type="text" id="modal-p-nombre" value="${escapeHtml(nombreVal)}" placeholder="Ej: Florencia" required autofocus>
            </div>
            <div class="paciente-modal-field">
              <label>Apellido *</label>
              <input type="text" id="modal-p-apellido" value="${escapeHtml(apellidoVal)}" placeholder="Ej: González" required>
            </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="paciente-modal-field">
              <label>Teléfono (WhatsApp) *</label>
              <input type="tel" id="modal-p-tel" value="${escapeHtml(paciente?.telefono || "")}" placeholder="Ej: 11 6123-4567 o 54911..." required>
              <small>Para WhatsApp y recordatorios automáticos.</small>
            </div>
            <div class="paciente-modal-field">
              <label>Email</label>
              <input type="email" id="modal-p-email" value="${escapeHtml(paciente?.email || "")}" placeholder="ejemplo@email.com">
              <small>Para avisos y confirmaciones de turnos.</small>
            </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="paciente-modal-field">
              <label>DNI / Documento</label>
              <input type="text" id="modal-p-dni" value="${escapeHtml(paciente?.dni || "")}" placeholder="Opcional">
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
            <input type="text" id="modal-p-motivo" value="${escapeHtml(paciente?.motivo_consulta || "")}" placeholder="Ej: ATM, RPG, Cervicalgia, Lumbalgia">
          </div>
          <div class="paciente-modal-field">
            <label>Notas Clínicas / Administrativas</label>
            <textarea id="modal-p-notas" rows="2" placeholder="Observaciones opcionales">${escapeHtml(paciente?.notas || "")}</textarea>
          </div>
          <div style="margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px; text-transform: uppercase;">
              👤 Contacto / Agendado por (opcional):
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px;">
              <div class="paciente-modal-field">
                <label>Nombre de quien agenda</label>
                <input type="text" id="modal-p-contacto-nombre" value="${escapeHtml(paciente?.contacto_nombre || "")}" placeholder="Ej: Laura Gómez (familiar / cónyuge / secretaria)">
              </div>
              <div class="paciente-modal-field">
                <label>Teléfono de contacto (WhatsApp)</label>
                <input type="tel" id="modal-p-contacto-tel" value="${escapeHtml(paciente?.contacto_telefono || "")}" placeholder="Ej: 11 6123-4567 o 54911...">
              </div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="paciente-modal-field">
                <label>Email de contacto</label>
                <input type="email" id="modal-p-contacto-email" value="${escapeHtml(paciente?.contacto_email || "")}" placeholder="contacto@ejemplo.com">
              </div>
              <div class="paciente-modal-field">
                <label>Relación o rol</label>
                <input type="text" id="modal-p-contacto-notas" value="${escapeHtml(paciente?.contacto_notas || "")}" placeholder="Ej: Cónyuge, Hijo/a, Secretaria">
              </div>
            </div>
          </div>
          <p id="modal-p-error" style="color:#dc2626; font-size:13px; margin:0;" hidden></p>
        </div>
        <div class="paciente-modal-footer">
          <button type="button" class="btn light btn-close-modal">Cancelar</button>
          <button type="submit" class="btn green" id="btn-submit-paciente">${isEdit ? "Guardar Cambios" : "Crear Paciente"}</button>
        </div>
      </form>
    </div>
  `;

  document.body.append(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelectorAll(".btn-close-modal").forEach((b) => b.addEventListener("click", close));

  const form = backdrop.querySelector("#form-full-paciente");
  const errorEl = backdrop.querySelector("#modal-p-error");
  const submitBtn = backdrop.querySelector("#btn-submit-paciente");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = backdrop.querySelector("#modal-p-nombre").value.trim();
    const apellido = backdrop.querySelector("#modal-p-apellido").value.trim();
    const tel = backdrop.querySelector("#modal-p-tel").value.trim();
    const email = backdrop.querySelector("#modal-p-email").value.trim();
    const dni = backdrop.querySelector("#modal-p-dni").value.trim();
    const prof = backdrop.querySelector("#modal-p-prof").value;
    const motivo = backdrop.querySelector("#modal-p-motivo").value.trim();
    const notas = backdrop.querySelector("#modal-p-notas").value.trim();
    const contactoNombre = backdrop.querySelector("#modal-p-contacto-nombre")?.value.trim() || "";
    const contactoTel = backdrop.querySelector("#modal-p-contacto-tel")?.value.trim() || "";
    const contactoEmail = backdrop.querySelector("#modal-p-contacto-email")?.value.trim() || "";
    const contactoNotas = backdrop.querySelector("#modal-p-contacto-notas")?.value.trim() || "";

    if (!nombre || !apellido || !tel) {
      errorEl.textContent = "Nombre, apellido y teléfono son obligatorios.";
      errorEl.hidden = false;
      return;
    }

    const nombreCompleto = `${nombre} ${apellido}`.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando…";
    errorEl.hidden = true;

    try {
      if (isEdit) {
        await api("pacientes.php", {
          method: "PUT",
          body: JSON.stringify({
            id: paciente.id,
            nombre: nombre,
            apellido: apellido,
            nombre_completo: nombreCompleto,
            telefono: tel,
            email: email,
            dni: dni,
            profesional_habitual: prof,
            motivo_consulta: motivo,
            notas: notas,
            contacto_nombre: contactoNombre,
            contacto_telefono: contactoTel,
            contacto_email: contactoEmail,
            contacto_notas: contactoNotas,
          }),
        });
      } else {
        await api("pacientes.php", {
          method: "POST",
          body: JSON.stringify({
            action: "insert",
            nombre: nombre,
            apellido: apellido,
            nombre_completo: nombreCompleto,
            telefono: tel,
            email: email,
            dni: dni,
            profesional_habitual: prof,
            motivo_consulta: motivo,
            notas: notas,
            contacto_nombre: contactoNombre,
            contacto_telefono: contactoTel,
            contacto_email: contactoEmail,
            contacto_notas: contactoNotas,
            origen: "admin",
          }),
        });
      }
      close();
      await loadPacientes();
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? "Guardar Cambios" : "Crear Paciente";
      errorEl.textContent = err.message || "Error al procesar la solicitud";
      errorEl.hidden = false;
    }
  });
}

// Inicialización del módulo de pacientes
export function initPacientesModule() {
  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce(() => {
        renderPacientesTable();
      }, 150)
    );
  }

  if (profFilter) {
    profFilter.addEventListener("change", (e) => {
      activeFilterProf = e.target.value;
      renderPacientesTable();
    });
  }

  if (btnNuevo) {
    btnNuevo.addEventListener("click", () => {
      openFullPacienteModal();
    });
  }

  if (btnBackupSql) {
    btnBackupSql.addEventListener("click", () => {
      window.location.href = "api/backup.php";
    });
  }
}
