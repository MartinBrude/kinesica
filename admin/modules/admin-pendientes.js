/**
 * Kinésica Admin — Tareas pendientes (Administración)
 * Badge y digesto viven en admin-pendientes-badge.js (≤250 líneas).
 */

import { api } from "./api.js?v=79";
import { dialogAlert, dialogConfirm } from "./dom.js?v=79";
import { setListControlsEnabled } from "./list-controls.js?v=1";
import {
  PENDIENTES_BADGE_USERNAME,
  getCachedDigestPaused,
  countOpenPendientes,
  updateDigestToggleUI,
  canShowPendientesBadge,
  setPendientesPendingBadge,
  refreshPendientesPendingBadge,
} from "./admin-pendientes-badge.js?v=1";
import {
  renderPendientesRows,
  setupPendientesDragAndDrop,
} from "./admin-pendientes-render.js?v=2";
import {
  closePendienteModal,
  isPendienteModalOpen,
  handleSavePendiente,
  initPendienteModalListeners,
} from "./admin-pendientes-modal.js?v=1";

export {
  PENDIENTES_BADGE_USERNAME,
  updateDigestToggleUI,
  canShowPendientesBadge,
  setPendientesPendingBadge,
  refreshPendientesPendingBadge,
  closePendienteModal,
  isPendienteModalOpen,
};

let cachedPendientes = [];
let currentFilter = "pendientes"; // 'todos' | 'pendientes' | 'resueltos'
let pendientesLoading = false;

const countPill = document.querySelector("#admin-pendientes-count-label");
const tbody = document.querySelector("#admin-pendientes-tbody");
const filterBtns = document.querySelectorAll(".admin-pendientes-filter-btn");
const digestToggleBtn = document.querySelector("#admin-btn-toggle-digest-pendientes");

export function syncPendientesBadgeFromCache() {
  setPendientesPendingBadge(countOpenPendientes(cachedPendientes));
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

async function reorderPendientes(srcId, targetId, position = "before", onReload) {
  if (!srcId || !targetId || srcId === targetId) return;
  const previous = [...cachedPendientes];
  const moved = cachedPendientes.find((p) => p.id === srcId);
  if (!moved) return;

  const copy = cachedPendientes.filter((p) => p.id !== srcId);
  const targetIdx = copy.findIndex((p) => p.id === targetId);
  if (targetIdx < 0) return;

  const insertIdx = position === "after" ? targetIdx + 1 : targetIdx;
  copy.splice(insertIdx, 0, moved);
  normalizeLocalPriorities(copy);
  cachedPendientes = copy;
  renderPendientes(cachedPendientes, onReload, srcId);

  const pendingIds = cachedPendientes.filter((p) => p.estado !== "resuelto").map((p) => p.id);
  try {
    const resp = await api("pendientes.php", {
      method: "POST",
      body: JSON.stringify({ action: "reorder", ids: pendingIds }),
    });
    if (resp && Array.isArray(resp.pendientes)) {
      cachedPendientes = resp.pendientes;
      renderPendientes(cachedPendientes, onReload, srcId);
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
  const pos = direction === "up" ? "before" : "after";
  reorderPendientes(id, targetId, pos, onReload);
}

export function renderPendientes(pendientes, onReload, highlightId = null) {
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
    highlightId,
  }));

  setupPendientesDragAndDrop(tbody, (src, target, pos) => reorderPendientes(src, target, pos, onReload));
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
    if (data) {
      if (typeof data.digest_paused === "boolean") {
        updateDigestToggleUI(data.digest_paused);
      }
      if (Array.isArray(data.pendientes)) {
        cachedPendientes = data.pendientes;
      }
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

  if (digestToggleBtn) {
    digestToggleBtn.addEventListener("click", async () => {
      const willPause = !getCachedDigestPaused();
      const msg = willPause
        ? "¿Pausar los recordatorios semanales por correo a Norberto?\n\nNo se enviarán digestos de pendientes los lunes hasta que los vuelvas a activar."
        : "¿Reanudar los recordatorios semanales por correo a Norberto?\n\nSe volverá a enviar el resumen de pendientes el próximo día hábil.";
      const ok = await dialogConfirm(msg);
      if (!ok) return;

      try {
        digestToggleBtn.disabled = true;
        const resp = await api("pendientes.php", {
          method: "POST",
          body: JSON.stringify({ action: "toggle_digest_pause", paused: willPause }),
        });
        if (resp && typeof resp.digest_paused === "boolean") {
          updateDigestToggleUI(resp.digest_paused);
        }
      } catch (err) {
        dialogAlert("No se pudo cambiar el estado de los mails: " + (err.message || "Error desconocido"));
      } finally {
        digestToggleBtn.disabled = false;
      }
    });
  }

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
