/**
 * Kinésica Admin — Tareas pendientes (Administración)
 * Badge de notificaciones: solo para Norberto.
 */

import { api } from "./api.js?v=79";
import { dialogAlert, dialogConfirm } from "./dom.js?v=79";
import { setListControlsEnabled } from "./list-controls.js?v=1";
import { getSessionUser } from "./auth.js?v=83";
import {
  renderPendientesRows,
  setupPendientesDragAndDrop,
} from "./admin-pendientes-render.js?v=1";
import {
  closePendienteModal,
  isPendienteModalOpen,
  handleSavePendiente,
  initPendienteModalListeners,
} from "./admin-pendientes-modal.js?v=1";

export const PENDIENTES_BADGE_USERNAME = "norberto";
export { closePendienteModal, isPendienteModalOpen };

let cachedPendientes = [];
let currentFilter = "pendientes"; // 'todos' | 'pendientes' | 'resueltos'
let pendientesLoading = false;

const countPill = document.querySelector("#admin-pendientes-count-label");
const tbody = document.querySelector("#admin-pendientes-tbody");
const filterBtns = document.querySelectorAll(".admin-pendientes-filter-btn");

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
  if (show) { el.setAttribute("aria-label", aria); el.title = aria; }
  else { el.removeAttribute("aria-label"); el.removeAttribute("title"); }
}

export function setPendientesPendingBadge(count) {
  const audience = canShowPendientesBadge();
  const n = audience ? Math.max(0, Number(count) || 0) : 0;
  const label = n > 99 ? "99+" : String(n);
  const show = n > 0;
  const aria = show ? `${n === 1 ? "1 pendiente" : `${n} pendientes`} en Administración` : "";

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

function normalizeLocalPriorities(list) {
  let pIdx = 1;
  list.forEach((i) => { i.prioridad = i.estado !== "resuelto" ? pIdx++ : 0; });
}

async function reorderPendientes(srcId, targetId, onReload) {
  if (!srcId || !targetId || srcId === targetId) return;
  const fromIdx = cachedPendientes.findIndex((p) => p.id === srcId);
  const toIdx = cachedPendientes.findIndex((p) => p.id === targetId);
  if (fromIdx < 0 || toIdx < 0) return;

  const previous = [...cachedPendientes];
  const copy = [...cachedPendientes];
  const [moved] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, moved);
  normalizeLocalPriorities(copy);
  cachedPendientes = copy;
  renderPendientes(cachedPendientes, onReload);

  const pendingIds = cachedPendientes.filter((p) => p.estado !== "resuelto").map((p) => p.id);
  try {
    const resp = await api("pendientes.php", {
      method: "POST",
      body: JSON.stringify({ action: "reorder", ids: pendingIds }),
    });
    if (resp && Array.isArray(resp.pendientes)) {
      cachedPendientes = resp.pendientes;
      renderPendientes(cachedPendientes, onReload);
    }
  } catch (err) {
    cachedPendientes = previous;
    renderPendientes(cachedPendientes, onReload);
    dialogAlert("No se pudo guardar el nuevo orden: " + (err.message || "Error desconocido"));
  }
}

function handleMovePriority(id, direction, onReload) {
  const pending = cachedPendientes.filter((p) => p.estado !== "resuelto");
  const pIdx = pending.findIndex((p) => p.id === id);
  if (pIdx < 0) return;
  const targetIdx = direction === "up" ? pIdx - 1 : pIdx + 1;
  if (targetIdx < 0 || targetIdx >= pending.length) return;
  const targetId = pending[targetIdx].id;
  reorderPendientes(id, targetId, onReload);
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
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--muted); padding:32px 16px;">
      ${pendientes.length === 0 ? "No hay tareas pendientes." : "No hay tareas con el filtro seleccionado."}
    </td></tr>`;
    return;
  }

  tbody.replaceChildren(...renderPendientesRows(filtered, {
    onToggle: (item) => handleTogglePendiente(item, onReload),
    onMovePriority: (id, dir) => handleMovePriority(id, dir, onReload),
  }));

  setupPendientesDragAndDrop(tbody, (src, target) => reorderPendientes(src, target, onReload));
}

async function handleTogglePendiente(item, onReload) {
  const isResuelto = item.estado === "resuelto";
  const confirmMsg = isResuelto
    ? `¿Reabrir la tarea "${item.titulo}"?`
    : `¿Marcar como resuelta la tarea "${item.titulo}"?`;
  const ok = await dialogConfirm(confirmMsg);
  if (!ok) return;

  try {
    const resp = await api("pendientes.php", {
      method: "POST",
      body: JSON.stringify({ action: "toggle_status", id: item.id }),
    });
    if (resp && Array.isArray(resp.pendientes)) {
      cachedPendientes = resp.pendientes;
    }
    if (typeof onReload === "function") await onReload();
    else await loadPendientesData();
  } catch (err) {
    dialogAlert("Error al cambiar estado: " + (err.message || "Error desconocido"));
  }
}

export async function loadPendientesData(onReload) {
  if (pendientesLoading) return;
  pendientesLoading = true;
  if (tbody && (!cachedPendientes || !cachedPendientes.length)) {
    tbody.innerHTML = `<tr><td colspan="4" class="admin-table-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Cargando pendientes…</span></td></tr>`;
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
  initPendienteModalListeners({
    onSubmit: (e) => handleSavePendiente(e, {
      onSuccess: async (resp) => {
        if (resp && Array.isArray(resp.pendientes)) {
          cachedPendientes = resp.pendientes;
        }
        if (currentFilter === "resueltos") {
          currentFilter = "pendientes";
          filterBtns.forEach((btn) => {
            btn.classList.toggle("is-active", btn.dataset.filter === "pendientes");
          });
        }
      },
      onReload,
    }),
  });
}
