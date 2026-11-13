import { switchActiveView } from "./dom.js?v=79";
import { setActiveStatusFilter } from "./interacciones-state.js";
import { loadInteracciones } from "./interacciones-load.js";
import { startAutoRefresh, stopAutoRefresh } from "./interacciones-refresh.js";
import {
  AUTO_REFRESH_INTERVAL_MS,
  AUTO_REFRESH_START_HOUR,
  AUTO_REFRESH_END_HOUR,
} from "./interacciones-constants.js";

export { isWithinAutoRefreshHours } from "./interacciones-hours.js";

export function showInteraccionesView() {
  const view = switchActiveView("view-interacciones");
  if (!view) return;

  try {
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "interacciones" }));
  } catch { /* ignore */ }

  setActiveStatusFilter("pending");
  loadInteracciones(true);
  startAutoRefresh();
}

export function hideInteraccionesView() {
  const view = document.getElementById("view-interacciones");
  if (view) view.hidden = true;
  stopAutoRefresh();
}

export { AUTO_REFRESH_INTERVAL_MS, AUTO_REFRESH_START_HOUR, AUTO_REFRESH_END_HOUR };
