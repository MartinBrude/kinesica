import { api } from "./api.js?v=79";
import { getSessionUser } from "./auth.js?v=83";
import { switchActiveView } from "./dom.js?v=79";
import { setActiveStatusFilter } from "./interacciones-state.js";
import { loadInteracciones } from "./interacciones-load.js?v=3";
import { startAutoRefresh, stopAutoRefresh } from "./interacciones-refresh.js";
import { stopTakeoverPoll } from "./interacciones-takeover-poll.js?v=1";
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
  // Mostrar de inmediato desde DB y reconciliar con n8n en segundo plano sin bloquear la UI.
  loadInteracciones(false).then(() => {
    if (getSessionUser()?.role === "colaborador") return;
    api("interacciones.php", {
      method: "POST",
      body: JSON.stringify({ action: "reconcile" }),
    })
      .then((res) => {
        const currentView = document.getElementById("view-interacciones");
        if (currentView && !currentView.hidden && Number(res?.inserted || 0) > 0) {
          loadInteracciones(false, { quiet: true });
        }
      })
      .catch(() => { /* reconciliación en segundo plano: ignorar fallo silenciosamente */ });
  });
  startAutoRefresh();
}

export function hideInteraccionesView() {
  const view = document.getElementById("view-interacciones");
  if (view) view.hidden = true;
  stopAutoRefresh();
  stopTakeoverPoll();
}

export { AUTO_REFRESH_INTERVAL_MS, AUTO_REFRESH_START_HOUR, AUTO_REFRESH_END_HOUR };
