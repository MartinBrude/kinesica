import { AUTO_REFRESH_INTERVAL_MS } from "./interacciones-constants.js";
import {
  getAutoRefreshTimer,
  setAutoRefreshTimer,
  getLastLoadedAt,
} from "./interacciones-state.js";
import { isWithinAutoRefreshHours } from "./interacciones-hours.js";
import { loadInteracciones } from "./interacciones-load.js";

export function updateLastUpdatedLabel() {
  const el = document.getElementById("interacciones-last-updated");
  const lastLoadedAt = getLastLoadedAt();
  if (!el) return;
  if (!lastLoadedAt) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  const d = new Date(lastLoadedAt);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  el.hidden = false;
  el.textContent = `Actualizado ${hh}:${mm}`;
  el.title = `Última sincronización: ${d.toLocaleString("es-AR")}`;
}

export function startAutoRefresh() {
  stopAutoRefresh();
  setAutoRefreshTimer(setInterval(() => {
    const view = document.getElementById("view-interacciones");
    if (
      view &&
      !view.hidden &&
      document.visibilityState === "visible" &&
      isWithinAutoRefreshHours()
    ) {
      loadInteracciones(false);
    }
  }, AUTO_REFRESH_INTERVAL_MS));
}

export function stopAutoRefresh() {
  const timer = getAutoRefreshTimer();
  if (timer) {
    clearInterval(timer);
    setAutoRefreshTimer(null);
  }
}
