import {
  getIsRefreshing,
  getLastLoadedAt,
  setPageSize,
  setDaysWindow,
  setCurrentPage,
  getActiveStatusFilter,
  setActiveStatusFilter,
} from "./interacciones-state.js";
import { startBadgePoll, refreshInteraccionesPendingBadge } from "./interacciones-badge.js";
import { loadInteracciones } from "./interacciones-load.js";
import { applyFilters } from "./interacciones-page.js";
import { isWithinAutoRefreshHours } from "./interacciones-hours.js";
import { AUTO_REFRESH_INTERVAL_MS } from "./interacciones-constants.js";

export function initInteraccionesModule() {
  const searchInput = document.getElementById("interacciones-search");
  const refreshBtn = document.getElementById("btn-refresh-interacciones");
  const pageSizeSelect = document.getElementById("interacciones-page-size");
  const daysSelect = document.getElementById("interacciones-days");
  const statsEl = document.getElementById("interacciones-stats");

  startBadgePoll();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshInteraccionesPendingBadge();
  });

  if (daysSelect) {
    setDaysWindow(Number(daysSelect.value) || 7);
    daysSelect.addEventListener("change", (e) => {
      setDaysWindow(Math.max(1, Math.min(90, Number(e.target.value) || 7)));
      setCurrentPage(0);
      loadInteracciones(true);
    });
  }

  if (pageSizeSelect) {
    setPageSize(Number(pageSizeSelect.value) || 20);
    pageSizeSelect.addEventListener("change", (e) => {
      if (getIsRefreshing()) return;
      setPageSize(Number(e.target.value) || 20);
      applyFilters(true);
    });
  }

  if (statsEl) {
    statsEl.addEventListener("click", (e) => {
      if (getIsRefreshing()) return;
      const btn = e.target.closest(".filter-pill");
      if (!btn) return;
      const filterType = btn.getAttribute("data-filter");
      if (!filterType) return;
      const current = getActiveStatusFilter();
      setActiveStatusFilter(current === filterType ? "all" : filterType);
      applyFilters(true);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (getIsRefreshing()) return;
      applyFilters(true);
    });
  }
  if (refreshBtn) refreshBtn.addEventListener("click", () => loadInteracciones(true));

  const triggerTabFocusRefresh = () => {
    const view = document.getElementById("view-interacciones");
    if (
      view &&
      !view.hidden &&
      document.visibilityState === "visible" &&
      isWithinAutoRefreshHours() &&
      Date.now() - getLastLoadedAt() >= AUTO_REFRESH_INTERVAL_MS
    ) {
      loadInteracciones(false);
    }
  };

  document.addEventListener("visibilitychange", triggerTabFocusRefresh);
  window.addEventListener("focus", triggerTabFocusRefresh);
}
