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

export function showPacientesView() {
  if (viewPacientes) {
    viewPacientes.hidden = false;
    // Ocultar otras vistas
    const views = ["#view-library", "#view-form", "#view-compare", "#view-gate"];
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
  listEl.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--muted);">Cargando directorio de pacientes…</td></tr>`;
  try {
    const res = await api("pacientes.php");
    pacientesCache = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
    renderPacientesTable();
  } catch (err) {
    listEl.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: #dc2626;">Error al cargar pacientes: ${escapeHtml(err.message)}</td></tr>`;
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
    const dniMatch = (p.dni || "").toLowerCase().includes(query);
    const motivoMatch = (p.motivo_consulta || "").toLowerCase().includes(query);
    return nameMatch || phoneMatch || dniMatch || motivoMatch;
  });
}

export function renderPacientesTable() {
  if (!listEl) return;
  const filtered = filterPacientes();

  if (countEl) {
    countEl.textContent = `${filtered.length} paciente${filtered.length === 1 ? "" : "s"}`;
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 32px; color: var(--muted);">No se encontraron pacientes que coincidan con la búsqueda.</td></tr>`;
    return;
  }

  listEl.innerHTML = "";
  filtered.forEach((p) => {
    const tr = document.createElement("tr");

    // Nombre completo para mostrar como texto único
    const fullName = p.nombre_completo || [p.nombre, p.apellido].filter(Boolean).join(" ") || "Paciente";

    // Teléfono formateado
    const rawTel = p.telefono || "";
    const waLink = rawTel ? `https://wa.me/${rawTel}` : "#";

    tr.innerHTML = `
      <td>
        <strong style="color: var(--navy);">${escapeHtml(fullName)}</strong>
      </td>
      <td>
        <div class="phone-cell">
          ${rawTel ? `<a class="phone-link" href="${waLink}" target="_blank" rel="noopener" title="Abrir chat de WhatsApp">📲 +${escapeHtml(rawTel)}</a>` : '<span style="color:var(--muted)">Sin teléfono</span>'}
        </div>
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
          <button type="button" class="btn ghost btn-delete-paciente" data-id="${p.id}" data-name="${escapeHtml(fullName)}" style="color:#dc2626;" title="Eliminar paciente">🗑️</button>
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
          <div class="paciente-modal-field">
            <label>Teléfono (WhatsApp) *</label>
            <input type="tel" id="modal-p-tel" value="${escapeHtml(paciente?.telefono || "")}" placeholder="Ej: 11 6123-4567 o 54911..." required>
            <small>Se usa para enviar recordatorios y confirmaciones automáticas de turnos.</small>
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
    const dni = backdrop.querySelector("#modal-p-dni").value.trim();
    const prof = backdrop.querySelector("#modal-p-prof").value;
    const motivo = backdrop.querySelector("#modal-p-motivo").value.trim();
    const notas = backdrop.querySelector("#modal-p-notas").value.trim();

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
            dni: dni,
            profesional_habitual: prof,
            motivo_consulta: motivo,
            notas: notas,
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
            dni: dni,
            profesional_habitual: prof,
            motivo_consulta: motivo,
            notas: notas,
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
