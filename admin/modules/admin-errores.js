/**
 * Kinésica Admin - Gestión de Reporte y Seguimiento de Errores
 */

import { api, formatDate } from "./api.js?v=77";
import { escapeHtml, dialogAlert, dialogConfirm } from "./dom.js?v=78";
import {
  openErrorModal,
  closeErrorModal,
  isErrorModalOpen,
  getErrorFormPayload,
  setErrorSaveButtonDisabled,
  bindErrorModalEvents,
} from "./admin-errores-modal.js";

export { isErrorModalOpen, closeErrorModal };

let cachedErrores = [];
let currentFilter = "todos"; // 'todos' | 'pendientes' | 'resueltos'

const btnNuevoError = document.querySelector("#admin-btn-nuevo-error");
const countPill = document.querySelector("#admin-errores-count-label");
const tbody = document.querySelector("#admin-errores-tbody");
const filterBtns = document.querySelectorAll(".admin-errores-filter-btn");

export function setErroresFilter(filter, onReload) {
  currentFilter = filter;
  filterBtns.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.filter === filter);
  });
  renderErrores(cachedErrores, onReload);
}

export function renderErrores(errores, onReload) {
  const total = errores.length;
  const resueltos = errores.filter((e) => e.estado === "resuelto").length;
  const pendientes = total - resueltos;

  if (countPill) {
    countPill.textContent = `${pendientes} pendiente${pendientes === 1 ? "" : "s"} · ${resueltos} resuelto${resueltos === 1 ? "" : "s"}`;
  }

  if (!tbody) return;

  const filtered = errores.filter((e) => {
    if (currentFilter === "pendientes") return e.estado !== "resuelto";
    if (currentFilter === "resueltos") return e.estado === "resuelto";
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--muted); padding:32px 16px;">
      ${errores.length === 0 ? "No hay errores reportados aún." : "No hay errores con el filtro seleccionado."}
    </td></tr>`;
    return;
  }

  tbody.replaceChildren(...filtered.map((item) => {
    const tr = document.createElement("tr");
    const isResuelto = item.estado === "resuelto";
    if (isResuelto) tr.classList.add("error-row-resolved");

    // 1. Estado
    const tdEstado = document.createElement("td");
    tdEstado.innerHTML = isResuelto
      ? '<span class="error-badge badge-resolved">✓ Resuelto</span>'
      : '<span class="error-badge badge-pending">⚡ Pendiente</span>';

    // 2. Sección
    const tdSeccion = document.createElement("td");
    tdSeccion.innerHTML = `<strong>${escapeHtml(item.seccion || "General")}</strong>`;

    // 3. Info & Contexto
    const tdInfo = document.createElement("td");
    tdInfo.innerHTML = `
      <div class="error-info-title">${escapeHtml(item.info)}</div>
      <div class="error-info-sub">Por <strong>${escapeHtml(item.created_by || "admin")}</strong> el ${escapeHtml(formatDate(item.created_at?.slice(0, 10)))}</div>
    `;

    // 4. Detalle (Actual vs Esperado)
    const tdDetalle = document.createElement("td");
    tdDetalle.className = "error-cell-behavior";
    tdDetalle.innerHTML = `
      <div class="behavior-block current"><span class="behavior-tag tag-actual">Actual:</span> ${escapeHtml(item.comportamiento_actual)}</div>
      <div class="behavior-block expected"><span class="behavior-tag tag-esperado">Esperado:</span> ${escapeHtml(item.comportamiento_esperado)}</div>
    `;

    // 5. Multimedia (Foto / Video)
    const tdMedia = document.createElement("td");
    tdMedia.className = "error-media-td";
    const mediaLinks = [];
    const isSafeMediaUrl = (url) => {
      if (!url || typeof url !== "string") return false;
      const u = url.trim().toLowerCase();
      return u.startsWith("https://") || u.startsWith("http://") || u.startsWith("/admin/api/") || u.startsWith("/admin/uploads/");
    };
    if (item.foto && isSafeMediaUrl(item.foto)) {
      mediaLinks.push(`<a href="${escapeHtml(item.foto)}" target="_blank" rel="noopener noreferrer" class="error-media-pill">📷 Foto</a>`);
    }
    if (item.video && isSafeMediaUrl(item.video)) {
      mediaLinks.push(`<a href="${escapeHtml(item.video)}" target="_blank" rel="noopener noreferrer" class="error-media-pill">🎬 Video</a>`);
    }
    tdMedia.innerHTML = mediaLinks.length > 0 ? mediaLinks.join(" ") : '<span style="color:var(--muted)">—</span>';

    // 6. Fecha / Resolución
    const tdFecha = document.createElement("td");
    tdFecha.innerHTML = isResuelto && item.resolved_at
      ? `<div style="font-size:12px; color:var(--text-success)">Resuelto el ${escapeHtml(formatDate(item.resolved_at?.slice(0, 10)))}</div>`
      : `<div style="font-size:12px; color:var(--muted)">${escapeHtml(formatDate(item.created_at?.slice(0, 10)))}</div>`;

    // 7. Acciones
    const tdActions = document.createElement("td");
    tdActions.className = "prof-actions-td";
    const cell = document.createElement("div");
    cell.className = "prof-actions-cell";

    const btnToggle = document.createElement("button");
    btnToggle.type = "button";
    btnToggle.className = `btn ghost btn-sm ${isResuelto ? "btn-reopen" : "btn-resolve"}`;
    btnToggle.textContent = isResuelto ? "Reabrir" : "Marcar Resuelto";
    btnToggle.addEventListener("click", () => handleToggleStatus(item, onReload));
    cell.appendChild(btnToggle);

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.className = "btn ghost btn-prof-toggle btn-gasto-delete btn-sm";
    btnDelete.textContent = "Eliminar";
    btnDelete.addEventListener("click", () => handleDeleteError(item, onReload));
    cell.appendChild(btnDelete);

    tdActions.appendChild(cell);
    tr.append(tdEstado, tdSeccion, tdInfo, tdDetalle, tdMedia, tdFecha, tdActions);
    return tr;
  }));
}

export async function handleSaveError(e, onReload) {
  if (e) e.preventDefault();
  const payload = getErrorFormPayload();
  if (!payload) {
    dialogAlert("Por favor completá la sección, la información y los comportamientos actual y esperado.");
    return;
  }
  setErrorSaveButtonDisabled(true);
  try {
    const res = await api("errores.php", {
      method: "POST",
      body: JSON.stringify({ action: "create", ...payload }),
    });
    dialogAlert("Error reportado correctamente.");
    closeErrorModal();
    if (typeof onReload === "function") await onReload();
  } catch (err) {
    dialogAlert("Error al reportar: " + (err.message || "Error desconocido"));
  } finally {
    setErrorSaveButtonDisabled(false);
  }
}

export async function handleToggleStatus(item, onReload) {
  const isResuelto = item.estado === "resuelto";
  const confirmMsg = isResuelto
    ? `¿Reabrir el reporte sobre "${item.seccion}"?`
    : `¿Marcar como resuelto el reporte sobre "${item.seccion}"?`;
  const ok = await dialogConfirm(confirmMsg);
  if (!ok) return;

  try {
    await api("errores.php", {
      method: "POST",
      body: JSON.stringify({ action: "toggle_status", id: item.id }),
    });
    if (typeof onReload === "function") await onReload();
  } catch (err) {
    dialogAlert("Error al cambiar estado: " + (err.message || "Error desconocido"));
  }
}

export async function handleDeleteError(item, onReload) {
  const ok = await dialogConfirm(`¿Seguro que deseas eliminar este reporte de error?`);
  if (!ok) return;

  try {
    await api("errores.php", {
      method: "POST",
      body: JSON.stringify({ action: "delete", id: item.id }),
    });
    if (typeof onReload === "function") await onReload();
  } catch (err) {
    dialogAlert("Error al eliminar reporte: " + (err.message || "Error desconocido"));
  }
}

export async function loadErroresData(onReload) {
  try {
    const data = await api("errores.php");
    if (data && Array.isArray(data.errores)) {
      cachedErrores = data.errores;
    }
  } catch (_) {
    // Modo offline o sin red
  }
  renderErrores(cachedErrores, onReload);
}

export function initErroresUI({ onReload }) {
  btnNuevoError?.addEventListener("click", openErrorModal);
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => setErroresFilter(btn.dataset.filter, onReload));
  });
  bindErrorModalEvents({
    onSaveSubmit: (e) => handleSaveError(e, onReload),
  });
}
