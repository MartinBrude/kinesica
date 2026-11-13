import { api } from "./api.js?v=79";
import { escapeHtml } from "./dom.js?v=79";
import { isMartinBrudePhone } from "./phone-search.js?v=3";
import { renderInteraccionesHealth } from "./interacciones-health.js?v=2";
import { setListControlsEnabled } from "./list-controls.js?v=1";
import {
  getCachedInteractions,
  setCachedInteractions,
  getDaysWindow,
  setDaysWindow,
  getIsRefreshing,
  setIsRefreshing,
  getPendingMutations,
  setLastLoadedAt,
} from "./interacciones-state.js";
import { setInteraccionesPendingBadge, syncBadgeFromCache } from "./interacciones-badge.js";
import { updateLastUpdatedLabel } from "./interacciones-refresh.js";
import { applyFilters } from "./interacciones-page.js";

export async function loadInteracciones(force = false) {
  const container = document.getElementById("interacciones-list-container");
  const refreshBtn = document.getElementById("btn-refresh-interacciones");
  if (!container) return;

  if (getIsRefreshing()) return;
  if (!force && getPendingMutations() > 0) return;
  setIsRefreshing(true);
  const filterRoots = [
    document.querySelector(".interacciones-toolbar"),
    document.getElementById("interacciones-stats"),
  ];
  setListControlsEnabled(filterRoots, false);

  if (refreshBtn && force) {
    refreshBtn.disabled = true;
    refreshBtn.style.opacity = "0.75";
    refreshBtn.innerHTML = `<span class="loading-spinner-sm" aria-hidden="true"></span> Actualizando...`;
  }

  if (container.children.length === 0) {
    container.innerHTML = `<div class="admin-view-loading" role="status"><span class="loading-spinner" aria-hidden="true"></span><span>Cargando conversaciones recientes...</span></div>`;
  }

  try {
    const daysWindow = getDaysWindow();
    const syncQ = force ? "&sync=1" : "";
    const query = `interacciones.php?days=${encodeURIComponent(String(daysWindow))}${syncQ}&_t=${Date.now()}`;
    const resp = await api(query, { cache: "no-store" });
    const isOk = Boolean(resp && (resp.ok === true || resp.status === "success" || Array.isArray(resp.items) || Array.isArray(resp.interactions)));
    if (!isOk) {
      if (getCachedInteractions().length === 0) {
        container.innerHTML = `<div class="interacciones-empty"><p>⚠️ No se pudieron cargar las interacciones en este momento.</p></div>`;
      }
      return;
    }
    if (typeof resp.days === "number" && resp.days > 0) {
      setDaysWindow(resp.days);
    }
    setLastLoadedAt(Date.now());
    updateLastUpdatedLabel();
    const rawList = Array.isArray(resp.items) ? resp.items : (Array.isArray(resp.interactions) ? resp.interactions : []);
    setCachedInteractions(rawList.map((item) => {
      if (item && (isMartinBrudePhone(item.wa_id) || isMartinBrudePhone(item.phone_formatted))) {
        return { ...item, patient_name: "Martín Brude" };
      }
      return item;
    }));
    if (typeof resp.unanswered_count === "number") {
      setInteraccionesPendingBadge(resp.unanswered_count);
    } else {
      syncBadgeFromCache();
    }
    applyFilters(false);
    renderInteraccionesHealth(document.getElementById("interacciones-stats"), resp.health, resp.sync, {
      days: getDaysWindow(),
      eventsCapped: Boolean(resp.events_capped),
    });

    if (refreshBtn && force) {
      refreshBtn.innerHTML = `✓ Actualizado`;
      setTimeout(() => {
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.style.opacity = "1";
          refreshBtn.innerHTML = `↻ Actualizar`;
        }
      }, 1200);
    }
  } catch (err) {
    if (getCachedInteractions().length === 0) {
      container.innerHTML = `<div class="interacciones-empty"><p>⚠️ Error al conectar con el servidor: ${escapeHtml(err.message || String(err))}</p></div>`;
    }
    if (refreshBtn && force) {
      refreshBtn.disabled = false;
      refreshBtn.style.opacity = "1";
      refreshBtn.innerHTML = `↻ Actualizar`;
    }
  } finally {
    setIsRefreshing(false);
    setListControlsEnabled(filterRoots, true);
  }
}
