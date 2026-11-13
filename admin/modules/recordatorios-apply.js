/**
 * Filtros y render de la lista de Recordatorios.
 */

import {
  renderRecordatoriosList,
  renderRecordatoriosPager,
  buildRecordatorioPages,
} from "./recordatorios-render.js?v=13";
import {
  filterRecordatoriosList,
  renderRecordatoriosStats,
} from "./recordatorios-filter.js?v=8";
import { recordatoriosStore, recalculateCounts } from "./recordatorios-store.js?v=1";

export function updateHeaderAndTotal(total) {
  const totalEl = document.getElementById("recordatorios-total");
  if (!totalEl) return;
  const countText = `${total} registro${total === 1 ? "" : "s"}`;
  if (recordatoriosStore.isRefreshing) {
    totalEl.innerHTML = `${countText} <span class="recordatorios-reloading-badge"><span class="recordatorios-spinner-sm" aria-hidden="true"></span> Recargando…</span>`;
  } else {
    totalEl.textContent = countText;
  }
}

export function applyFiltersAndRender() {
  const container = document.getElementById("recordatorios-list-container");
  const search = document.getElementById("recordatorios-search")?.value || "";

  if (!recordatoriosStore.hasLoadedOnce && recordatoriosStore.isRefreshing) {
    if (container) {
      renderRecordatoriosList(container, [], {
        isLoading: true,
        isRefreshing: true,
        hasLoadedOnce: false,
        totalCached: 0,
        activeStatusFilter: recordatoriosStore.activeStatusFilter,
        searchTerm: search,
      });
    }
    renderRecordatoriosStats(document.getElementById("recordatorios-stats"), {
      counts: recordatoriosStore.cachedCounts,
      activeStatusFilter: recordatoriosStore.activeStatusFilter,
    });
    updateHeaderAndTotal(0);
    return;
  }

  recordatoriosStore.filteredItems = filterRecordatoriosList(
    recordatoriosStore.cachedItems,
    search,
    recordatoriosStore.activeStatusFilter
  );
  const total = recordatoriosStore.filteredItems.length;
  const pages = buildRecordatorioPages(recordatoriosStore.filteredItems);
  const maxPage = Math.max(0, pages.length - 1);
  if (recordatoriosStore.currentPage > maxPage) recordatoriosStore.currentPage = maxPage;
  const page = pages[recordatoriosStore.currentPage] || { items: [], label: "" };
  const slice = page.items || [];

  renderRecordatoriosList(container, slice, {
    isLoading: false,
    isRefreshing: recordatoriosStore.isRefreshing,
    hasLoadedOnce: recordatoriosStore.hasLoadedOnce,
    totalCached: recordatoriosStore.cachedItems.length,
    activeStatusFilter: recordatoriosStore.activeStatusFilter,
    searchTerm: search,
  });

  renderRecordatoriosPager(document.getElementById("recordatorios-pager"), {
    currentPage: recordatoriosStore.currentPage,
    totalPages: Math.max(1, pages.length),
    pageLabel: page.label || "",
    onPageChange: (p) => {
      recordatoriosStore.currentPage = p;
      applyFiltersAndRender();
    },
  });

  const counts = recalculateCounts();
  renderRecordatoriosStats(document.getElementById("recordatorios-stats"), {
    counts,
    activeStatusFilter: recordatoriosStore.activeStatusFilter,
  });

  updateHeaderAndTotal(total);
}

export function applyRecordatorioItemUpdate(updatedItem) {
  const idx = recordatoriosStore.cachedItems.findIndex((it) => String(it.id) === String(updatedItem.id));
  if (idx !== -1) {
    recordatoriosStore.cachedItems[idx] = { ...recordatoriosStore.cachedItems[idx], ...updatedItem };
  } else {
    recordatoriosStore.cachedItems.unshift(updatedItem);
  }
  recalculateCounts();
  applyFiltersAndRender();
}
