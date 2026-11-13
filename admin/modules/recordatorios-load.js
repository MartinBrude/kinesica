/**
 * Carga de recordatorios desde API.
 */

import { api } from "./api.js?v=79";
import { setListControlsEnabled } from "./list-controls.js?v=1";
import { recordatoriosStore, isBlockedRecordatorio, deduplicateRecordatorios, recalculateCounts } from "./recordatorios-store.js?v=1";
import { applyFiltersAndRender, updateHeaderAndTotal } from "./recordatorios-apply.js?v=1";
import { renderRecordatoriosSync } from "./recordatorios-sync.js?v=1";

export async function loadRecordatorios(force = false) {
  const container = document.getElementById("recordatorios-list-container");
  const refreshBtn = document.getElementById("btn-refresh-recordatorios");
  if (!container || recordatoriosStore.isRefreshing) return;
  recordatoriosStore.isRefreshing = true;
  const filterRoots = [
    document.querySelector(".recordatorios-toolbar"),
    document.getElementById("recordatorios-stats"),
  ];
  setListControlsEnabled(filterRoots, false);

  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = `<span class="recordatorios-spinner-sm" aria-hidden="true"></span> Actualizando...`;
    refreshBtn.style.opacity = "0.75";
  }

  if (!recordatoriosStore.hasLoadedOnce || !recordatoriosStore.cachedItems.length) {
    container.innerHTML = `
      <div class="recordatorios-empty is-loading">
        <span class="loading-spinner" aria-hidden="true"></span>
        <p>Cargando recordatorios...</p>
      </div>`;
  }
  updateHeaderAndTotal(recordatoriosStore.filteredItems.length);

  try {
    const syncQ = force ? "&sync=1" : "";
    const resp = await api(`recordatorios.php?days=14${syncQ}&_t=${Date.now()}`, { cache: "no-store" });
    const ok = Boolean(resp && (resp.ok === true || resp.status === "success"));
    if (!ok) {
      if (!recordatoriosStore.cachedItems.length) {
        container.innerHTML = `<div class="recordatorios-empty"><p>No se pudieron cargar los recordatorios.</p></div>`;
      }
      return;
    }
    const rawItems = Array.isArray(resp.items) ? resp.items : [];
    const validItems = rawItems.filter((it) => !isBlockedRecordatorio(it));
    recordatoriosStore.cachedItems = deduplicateRecordatorios(validItems);
    recordatoriosStore.cachedCounts = recalculateCounts();
    recordatoriosStore.hasLoadedOnce = true;
    recordatoriosStore.lastLoadedAt = Date.now();
    renderRecordatoriosSync(resp);
    applyFiltersAndRender();

    if (refreshBtn && force) {
      refreshBtn.textContent = "✓ Actualizado";
      setTimeout(() => {
        if (refreshBtn && !recordatoriosStore.isRefreshing) {
          refreshBtn.textContent = "↻ Actualizar";
          refreshBtn.disabled = false;
          refreshBtn.style.opacity = "1";
        }
      }, 1500);
    }
  } catch {
    if (!recordatoriosStore.cachedItems.length) {
      container.innerHTML = `<div class="recordatorios-empty"><p>Error al cargar recordatorios.</p></div>`;
    }
  } finally {
    recordatoriosStore.isRefreshing = false;
    setListControlsEnabled(filterRoots, true);
    updateHeaderAndTotal(recordatoriosStore.filteredItems.length);
    if (refreshBtn && (!force || refreshBtn.textContent !== "✓ Actualizado")) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "↻ Actualizar";
      refreshBtn.style.opacity = "1";
    }
  }
}
