/**
 * Kinésica Admin - Módulo de Gestión de Pacientes y Directorio de Teléfonos
 * Permite buscar, ver, dar de alta y editar teléfonos para WhatsApp y recordatorios.
 */

import { api } from "./api.js?v=77";
import { escapeHtml, debounce, dialogAlert, dialogConfirm, switchActiveView } from "./dom.js?v=78";
import { phoneMatches } from "./phone-search.js?v=1";
import { formatDisplayPhone } from "./pacientes-format.js";
import { openFullPacienteModal } from "./pacientes-modal.js";

export { formatDisplayPhone };

const viewPacientes = typeof document !== "undefined" ? document.querySelector("#view-pacientes") : null;
const listEl = typeof document !== "undefined" ? document.querySelector("#pacientes-list-tbody") : null;
const searchInput = typeof document !== "undefined" ? document.querySelector("#search-pacientes") : null;
const profFilter = typeof document !== "undefined" ? document.querySelector("#filter-pacientes-prof") : null;
const btnNuevo = typeof document !== "undefined" ? document.querySelector("#btn-nuevo-paciente") : null;
const btnBackupSql = typeof document !== "undefined" ? document.querySelector("#btn-backup-sql") : null;
const countEl = typeof document !== "undefined" ? document.querySelector("#pacientes-total-count") : null;

let pacientesCache = [];
let activeFilterProf = "todos";

export function showPacientesView() {
  const view = switchActiveView("view-pacientes");
  if (view) {
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "pacientes" }));
    } catch {}
    loadPacientes();
  }
}

export function hidePacientesView() {
  if (viewPacientes) viewPacientes.hidden = true;
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

/**
 * Devuelve el apellido y nombre(s) estructurados a partir de un objeto paciente.
 * @param {object} p
 * @returns {{ apellido: string, nombre: string, display: string }}
 */
export function formatPatientName(p) {
  let ap = (p?.apellido || "").trim();
  let nom = (p?.nombre || "").trim();

  if (!ap && !nom) {
    const full = (p?.nombre_completo || "").trim();
    if (full) {
      const parts = full.split(/\s+/);
      if (parts.length === 1) {
        nom = parts[0];
      } else {
        nom = parts.slice(0, parts.length > 2 ? 2 : 1).join(" ");
        ap = parts.slice(parts.length > 2 ? 2 : 1).join(" ");
      }
    }
  }

  let display = "";
  if (ap && nom) display = `${ap}, ${nom}`;
  else if (ap) display = ap;
  else if (nom) display = nom;
  else display = (p?.nombre_completo || "").trim() || "Paciente";

  return { apellido: ap, nombre: nom, display };
}

function filterPacientes() {
  const query = (searchInput?.value || "").toLowerCase().trim();
  const list = pacientesCache.filter((p) => {
    if (activeFilterProf !== "todos" && p.profesional_habitual !== activeFilterProf) return false;
    if (!query) return true;
    const nameMatch = (p.nombre_completo || "").toLowerCase().includes(query) ||
                      (p.nombre || "").toLowerCase().includes(query) ||
                      (p.apellido || "").toLowerCase().includes(query);
    const phoneMatch = (p.telefono || "").includes(query) || phoneMatches(p.telefono, query);
    const emailMatch = (p.email || "").toLowerCase().includes(query);
    const dniMatch = (p.dni || "").toLowerCase().includes(query);
    const motivoMatch = (p.motivo_consulta || "").toLowerCase().includes(query);
    const contactMatch = (p.contacto_nombre || "").toLowerCase().includes(query) ||
                         (p.contacto_telefono || "").includes(query) || phoneMatches(p.contacto_telefono, query) ||
                         (p.contacto_notas || "").toLowerCase().includes(query);
    return nameMatch || phoneMatch || emailMatch || dniMatch || motivoMatch || contactMatch;
  });

  list.sort((a, b) => {
    const nameA = formatPatientName(a);
    const nameB = formatPatientName(b);
    const cmpAp = nameA.apellido.localeCompare(nameB.apellido, "es", { sensitivity: "base" });
    if (cmpAp !== 0) return cmpAp;
    return nameA.nombre.localeCompare(nameB.nombre, "es", { sensitivity: "base" });
  });

  return list;
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
    const formattedName = formatPatientName(p);
    const displayName = formattedName.display;
    const fullNameForConfirm = p.nombre_completo || [p.nombre, p.apellido].filter(Boolean).join(" ") || displayName;

    const contactBadge = (p.contacto_nombre || p.contacto_telefono)
      ? `<div style="font-size: 11px; color: #475569; margin-top: 3px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; display: inline-block;">
           👤 Contacto / Agendó: <strong>${escapeHtml(p.contacto_nombre || "Familiar")}</strong>${p.contacto_telefono ? ` (${escapeHtml(formatDisplayPhone(p.contacto_telefono))})` : ""}${p.contacto_notas ? ` • ${escapeHtml(p.contacto_notas)}` : ""}
         </div>`
      : "";

    const rawTel = p.telefono || "";
    const waLink = rawTel ? `https://wa.me/${rawTel}` : "#";
    const displayTel = formatDisplayPhone(rawTel);

    tr.innerHTML = `
      <td><strong style="color: var(--navy);">${escapeHtml(displayName)}</strong>${contactBadge}</td>
      <td><div class="phone-cell">${rawTel ? `<a class="phone-link" href="${waLink}" target="_blank" rel="noopener" title="Abrir chat de WhatsApp">📲 ${escapeHtml(displayTel)}</a>` : '<span style="color:var(--muted)">Sin teléfono</span>'}</div></td>
      <td>${p.email ? `<a class="email-link" href="mailto:${escapeHtml(p.email)}" title="Enviar correo a ${escapeHtml(p.email)}">✉️ ${escapeHtml(p.email)}</a>` : '<span style="color:var(--muted)">—</span>'}</td>
      <td>${p.dni ? escapeHtml(p.dni) : '<span style="color:var(--muted)">—</span>'}</td>
      <td><span class="badge-prof ${escapeHtml(p.profesional_habitual || "indistinto")}">${escapeHtml(p.profesional_habitual || "indistinto")}</span></td>
      <td><small>${p.motivo_consulta ? escapeHtml(p.motivo_consulta) : "—"}</small></td>
      <td style="text-align: right;">
        <div class="pacientes-actions">
          <button type="button" class="btn light btn-edit-paciente" data-id="${p.id}" title="Editar paciente">Editar</button>
          <button type="button" class="btn ghost btn-delete-paciente btn-icon-del" data-id="${p.id}" data-name="${escapeHtml(fullNameForConfirm)}" title="Eliminar paciente" aria-label="Eliminar paciente">
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

  listEl.querySelectorAll(".btn-edit-paciente").forEach((btn) => {
    btn.addEventListener("click", () => {
      const paciente = pacientesCache.find((p) => String(p.id) === String(btn.dataset.id));
      if (paciente) openFullPacienteModal(paciente, loadPacientes);
    });
  });

  listEl.querySelectorAll(".btn-delete-paciente").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmed = await dialogConfirm(
        `¿Confirmás que querés eliminar al paciente "${btn.dataset.name}" del directorio?`,
        { danger: true, okText: "Eliminar", cancelText: "Cancelar" }
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

export function initPacientesModule() {
  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => renderPacientesTable(), 150));
  }
  if (profFilter) {
    profFilter.addEventListener("change", (e) => {
      activeFilterProf = e.target.value;
      renderPacientesTable();
    });
  }
  if (btnNuevo) {
    btnNuevo.addEventListener("click", () => openFullPacienteModal(null, loadPacientes));
  }
  if (btnBackupSql) {
    btnBackupSql.addEventListener("click", async () => {
      try {
        const res = await fetch("api/backup.php", {
          headers: { "X-Kinesica": "1" },
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) {
          let errMsg = "No se pudo descargar el backup SQL.";
          try {
            const data = await res.json();
            if (data?.error) errMsg = data.error;
          } catch (_) {}
          await dialogAlert(errMsg);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kinesica-backup-${new Date().toISOString().slice(0, 10)}.sql`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (_) {
        await dialogAlert("Error de conexión al descargar el backup SQL.");
      }
    });
  }
}
