/**
 * Vista Recordatorios — show/hide y auto-refresh.
 */

import { switchActiveView } from "./dom.js?v=79";
import { renderRecordatoriosRules } from "./recordatorios-rules.js?v=7";
import { recordatoriosStore, CACHE_TTL_MS } from "./recordatorios-store.js?v=1";
import { applyFiltersAndRender } from "./recordatorios-apply.js?v=1";
import { loadRecordatorios } from "./recordatorios-load.js?v=1";

function startAutoRefresh() {
  stopAutoRefresh();
  recordatoriosStore.autoRefreshTimer = setInterval(() => {
    const view = document.getElementById("view-recordatorios");
    if (
      view &&
      !view.hidden &&
      document.visibilityState === "visible" &&
      !document.querySelector(".recordatorio-modal-backdrop") &&
      Date.now() - recordatoriosStore.lastLoadedAt >= 30000
    ) {
      loadRecordatorios(false);
    }
  }, 45000);
}

function stopAutoRefresh() {
  if (recordatoriosStore.autoRefreshTimer) {
    clearInterval(recordatoriosStore.autoRefreshTimer);
    recordatoriosStore.autoRefreshTimer = null;
  }
}

export function showRecordatoriosView() {
  const view = switchActiveView("view-recordatorios");
  if (!view) return;
  try {
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "recordatorios" }));
  } catch { /* ignore */ }
  renderRecordatoriosRules(document.getElementById("recordatorios-rules"));

  const isFresh = recordatoriosStore.hasLoadedOnce && (Date.now() - recordatoriosStore.lastLoadedAt < CACHE_TTL_MS);
  if (isFresh) {
    applyFiltersAndRender();
  } else {
    loadRecordatorios(false);
  }
  startAutoRefresh();
}

export function hideRecordatoriosView() {
  const view = document.getElementById("view-recordatorios");
  if (view) view.hidden = true;
  stopAutoRefresh();
}
