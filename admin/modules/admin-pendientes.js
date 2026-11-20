/**
 * Kinésica Admin — Tareas pendientes (Administración)
 * Badge de notificaciones: solo para Norberto.
 */

import { api, formatDate } from "./api.js?v=79";
import { escapeHtml, dialogAlert, dialogConfirm, toast } from "./dom.js?v=79";
import { setListControlsEnabled } from "./list-controls.js?v=1";
import { getSessionUser } from "./auth.js?v=83";

/** Username que recibe el badge de tareas pendientes. */
export const PENDIENTES_BADGE_USERNAME = "norberto";

let cachedPendientes = [];
let currentFilter = "pendientes"; // 'todos' | 'pendientes' | 'resueltos'
let pendientesLoading = false;

const countPill = document.querySelector("#admin-pendientes-count-label");
const tbody = document.querySelector("#admin-pendientes-tbody");
const filterBtns = document.querySelectorAll(".admin-pendientes-filter-btn");
const btnNuevo = document.querySelector("#admin-btn-nuevo-pendiente");
const modal = document.querySelector("#admin-pendiente-modal");
const form = document.querySelector("#admin-pendiente-form");
const inputTitulo = document.querySelector("#admin-pendiente-titulo");
const btnSave = document.querySelector("#admin-pendiente-modal-save");

function openPendienteModal() {
  if (!modal) return;
  if (form) form.reset();
  modal.hidden = false;
  queueMicrotask(() => inputTitulo?.focus());
}

function closePendienteModal() {
  if (!modal) return;
  modal.hidden = true;
  if (form) form.reset();
}

function setSaveDisabled(disabled) {
  if (btnSave) btnSave.disabled = Boolean(disabled);
}

export function isPendienteModalOpen() {
  return Boolean(modal && !modal.hidden);
}

export { closePendienteModal };

function countOpen(list) {
  return (Array.isArray(list) ? list : []).filter((i) => i && i.estado !== "resuelto").length;
}

export function canShowPendientesBadge(user = getSessionUser()) {
  return String(user?.username || "").toLowerCase() === PENDIENTES_BADGE_USERNAME;
}

function applyBadgeEl(el, show, label, aria) {
  if (!el) return;
  el.textContent = label;
  el.hidden = !show;
  el.setAttribute("aria-hidden", show ? "false" : "true");
  if (show) {
    el.setAttribute("aria-label", aria);
    el.title = aria;
  } else {
    el.removeAttribute("aria-label");
    el.removeAttribute("title");
  }
}

/**
 * Actualiza el badge de Pendientes.
 * Solo Norberto ve el contador (menú + grupo Administración).
 * Otros usuarios: oculta el badge del ítem Pendientes sin tocar el del grupo.
 */
export function setPendientesPendingBadge(count) {
  const audience = canShowPendientesBadge();
  const n = audience ? Math.max(0, Number(count) || 0) : 0;
  const label = n > 99 ? "99+" : String(n);
  const show = n > 0;
  const aria = show
    ? `${n === 1 ? "1 pendiente" : `${n} pendientes`} en Administración`
    : "";

  applyBadgeEl(document.getElementById("nav-badge-pendientes"), show, label, aria);

  if (!audience) return;

  applyBadgeEl(document.getElementById("nav-badge-admin"), show, label, aria);
  const adminBtn = document.getElementById("nav-btn-admin");
  if (adminBtn) {
    if (show) adminBtn.setAttribute("aria-label", `Administración, ${aria}`);
    else adminBtn.removeAttribute("aria-label");
  }
}

export function syncPendientesBadgeFromCache() {
  setPendientesPendingBadge(countOpen(cachedPendientes));
}

export async function refreshPendientesPendingBadge() {
  if (!canShowPendientesBadge()) {
    setPendientesPendingBadge(0);
    return;
  }
  try {
    const resp = await api(`pendientes.php?counts_only=1&_t=${Date.now()}`, { cache: "no-store" });
    if (!resp || resp.status !== "success") return;
    const count =
      typeof resp.pending_count === "number"
        ? resp.pending_count
        : Number(resp.totales?.pendientes) || 0;
    setPendientesPendingBadge(count);
  } catch {
    /* silencioso */
  }
}

export function setPendientesFilter(filter, onReload) {
  if (pendientesLoading) return;
  currentFilter = filter;
  filterBtns.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.filter === filter);
  });
  renderPendientes(cachedPendientes, onReload);
}

export function renderPendientes(pendientes, onReload) {
  const total = pendientes.length;
  const resueltos = pendientes.filter((e) => e.estado === "resuelto").length;
  const open = total - resueltos;

  setPendientesPendingBadge(open);

  if (countPill) {
    countPill.textContent = `${open} pendiente${open === 1 ? "" : "s"} · ${resueltos} resuelto${resueltos === 1 ? "" : "s"}`;
  }

  if (!tbody) return;

  const filtered = pendientes.filter((e) => {
    if (currentFilter === "pendientes") return e.estado !== "resuelto";
    if (currentFilter === "resueltos") return e.estado === "resuelto";
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--muted); padding:32px 16px;">
      ${pendientes.length === 0 ? "No hay tareas pendientes." : "No hay tareas con el filtro seleccionado."}
    </td></tr>`;
    return;
  }

  tbody.replaceChildren(...filtered.map((item) => {
    const tr = document.createElement("tr");
    const isResuelto = item.estado === "resuelto";
    if (isResuelto) tr.classList.add("error-row-resolved");

    const tdEstado = document.createElement("td");
    tdEstado.innerHTML = isResuelto
      ? '<span class="error-badge badge-resolved">✓ Resuelto</span>'
      : '<span class="error-badge badge-pending">⚡ Pendiente</span>';

    const tdTitulo = document.createElement("td");
    tdTitulo.innerHTML = `
      <div class="error-info-title">${escapeHtml(item.titulo || "")}</div>
      <div class="error-info-sub">${
        isResuelto && item.resolved_at
          ? `Resuelto por <strong>${escapeHtml(item.resolved_by || "admin")}</strong> el ${escapeHtml(formatDate(String(item.resolved_at).slice(0, 10)))}`
          : "Tarea administrativa pendiente"
      }</div>
    `;

    const tdActions = document.createElement("td");
    tdActions.className = "prof-actions-td";
    const cell = document.createElement("div");
    cell.className = "prof-actions-cell";

    const btnToggle = document.createElement("button");
    btnToggle.type = "button";
    btnToggle.className = `btn ghost btn-sm ${isResuelto ? "btn-reopen" : "btn-resolve"}`;
    btnToggle.textContent = isResuelto ? "Reabrir" : "Marcar resuelto";
    btnToggle.addEventListener("click", () => handleTogglePendiente(item, onReload));
    cell.appendChild(btnToggle);

    tdActions.appendChild(cell);
    tr.append(tdEstado, tdTitulo, tdActions);
    return tr;
  }));
}

async function handleTogglePendiente(item, onReload) {
  const isResuelto = item.estado === "resuelto";
  const confirmMsg = isResuelto
    ? `¿Reabrir la tarea "${item.titulo}"?`
    : `¿Marcar como resuelta la tarea "${item.titulo}"?`;
  const ok = await dialogConfirm(confirmMsg);
  if (!ok) return;

  try {
    await api("pendientes.php", {
      method: "POST",
      body: JSON.stringify({ action: "toggle_status", id: item.id }),
    });
    if (typeof onReload === "function") await onReload();
    else await loadPendientesData();
  } catch (err) {
    dialogAlert("Error al cambiar estado: " + (err.message || "Error desconocido"));
  }
}

async function handleSavePendiente(e, onReload) {
  if (e) e.preventDefault();
  const titulo = String(inputTitulo?.value || "").trim();
  if (!titulo) {
    dialogAlert("Escribí el título de la tarea.");
    inputTitulo?.focus();
    return;
  }
  if (titulo.length > 255) {
    dialogAlert("El título no puede superar los 255 caracteres.");
    inputTitulo?.focus();
    return;
  }

  setSaveDisabled(true);
  try {
    await api("pendientes.php", {
      method: "POST",
      body: JSON.stringify({ action: "create", titulo }),
    });
    toast("Pendiente agregado.", { type: "success" });
    closePendienteModal();
    if (currentFilter === "resueltos") {
      currentFilter = "pendientes";
      filterBtns.forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.filter === "pendientes");
      });
    }
    if (typeof onReload === "function") await onReload();
    else await loadPendientesData();
  } catch (err) {
    dialogAlert("Error al agregar pendiente: " + (err.message || "Error desconocido"));
  } finally {
    setSaveDisabled(false);
  }
}

export async function loadPendientesData(onReload) {
  if (pendientesLoading) return;
  pendientesLoading = true;
  if (tbody && (!cachedPendientes || !cachedPendientes.length)) {
    tbody.innerHTML = `<tr><td colspan="3" class="admin-table-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Cargando pendientes…</span></td></tr>`;
  }
  const filterRoot = document.querySelector("#view-admin .admin-pendientes-filters")
    || document.querySelector(".admin-pendientes-filters");
  setListControlsEnabled(filterRoot, false, { extra: Array.from(filterBtns) });
  try {
    const data = await api("pendientes.php");
    if (data && Array.isArray(data.pendientes)) {
      cachedPendientes = data.pendientes;
    }
  } catch (_) {
    /* offline */
  } finally {
    pendientesLoading = false;
    setListControlsEnabled(filterRoot, true, { extra: Array.from(filterBtns) });
  }
  renderPendientes(cachedPendientes, onReload);
}

export function initPendientesUI({ onReload }) {
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => setPendientesFilter(btn.dataset.filter, onReload));
  });
  btnNuevo?.addEventListener("click", openPendienteModal);
  document.getElementById("admin-pendiente-modal-close")?.addEventListener("click", closePendienteModal);
  document.getElementById("admin-pendiente-modal-cancel")?.addEventListener("click", closePendienteModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closePendienteModal();
  });
  form?.addEventListener("submit", (e) => handleSavePendiente(e, onReload));
}
