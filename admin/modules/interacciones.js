/**
 * Kinésica Admin - Módulo de Interacciones WhatsApp (Clara)
 * Muestra el historial cronológico de personas que le escribieron a Clara,
 * agrupadas por fecha, con su resumen de consulta y acceso directo para
 * abrir WhatsApp y responderles en un solo click.
 */

import { api } from "./api.js?v=78";
import { getSessionUser } from "./auth.js?v=83";
import { escapeHtml, switchActiveView, dialogConfirm, toast } from "./dom.js?v=79";
import {
  formatDateHeader,
  buildInteractionCardHtml,
  renderPager,
  bindInteractionEvents,
} from "./interacciones-render.js?v=4";
import { filterInteractionsList, renderStatsHeader } from "./interacciones-filter.js?v=2";
import { isMartinBrudePhone } from "./phone-search.js?v=3";
import { renderInteraccionesHealth } from "./interacciones-health.js?v=2";
import { setListControlsEnabled } from "./list-controls.js?v=1";

export const AUTO_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
export const AUTO_REFRESH_START_HOUR = 9;
export const AUTO_REFRESH_END_HOUR = 19;

let cachedInteractions = [];
let filteredInteractions = [];
let currentPage = 0;
let pageSize = 20;
/** Ventana pedida al servidor (días locales). Debe coincidir con INTERACCIONES_DEFAULT_DAYS. */
let daysWindow = 7;
let activeStatusFilter = "pending"; // "all" | "pending" | "answered" | "archived"
let autoRefreshTimer = null;
let isRefreshing = false;
let lastLoadedAt = 0;
/** Escrituras en vuelo: el auto-refresh no debe pisar updates optimistas. */
let pendingMutations = 0;
/** IDs de hilos de chat abiertos; se conservan al re-renderizar (auto-refresh). */
const expandedThreadIds = new Set();

export function isWithinAutoRefreshHours(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const totalMinutes = d.getHours() * 60 + d.getMinutes();
  return (
    totalMinutes >= AUTO_REFRESH_START_HOUR * 60 &&
    totalMinutes <= AUTO_REFRESH_END_HOUR * 60
  );
}

export function showInteraccionesView() {
  const view = switchActiveView("view-interacciones");
  if (!view) return;

  try {
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "interacciones" }));
  } catch { /* ignore */ }

  activeStatusFilter = "pending";
  loadInteracciones(true);
  startAutoRefresh();
}

export function hideInteraccionesView() {
  const view = document.getElementById("view-interacciones");
  if (view) view.hidden = true;
  stopAutoRefresh();
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = setInterval(() => {
    const view = document.getElementById("view-interacciones");
    if (
      view &&
      !view.hidden &&
      document.visibilityState === "visible" &&
      isWithinAutoRefreshHours()
    ) {
      loadInteracciones(false);
    }
  }, AUTO_REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

function updateLastUpdatedLabel() {
  const el = document.getElementById("interacciones-last-updated");
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

export async function loadInteracciones(force = false) {
  const container = document.getElementById("interacciones-list-container");
  const refreshBtn = document.getElementById("btn-refresh-interacciones");
  if (!container) return;

  if (isRefreshing) return;
  // Poll automático: no reemplazar cache mientras hay archive/toggle en curso.
  if (!force && pendingMutations > 0) return;
  isRefreshing = true;
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
    const syncQ = force ? "&sync=1" : "";
    const query = `interacciones.php?days=${encodeURIComponent(String(daysWindow))}${syncQ}&_t=${Date.now()}`;
    const resp = await api(query, { cache: "no-store" });
    const isOk = Boolean(resp && (resp.ok === true || resp.status === "success" || Array.isArray(resp.items) || Array.isArray(resp.interactions)));
    if (!isOk) {
      if (cachedInteractions.length === 0) {
        container.innerHTML = `<div class="interacciones-empty"><p>⚠️ No se pudieron cargar las interacciones en este momento.</p></div>`;
      }
      return;
    }
    if (typeof resp.days === "number" && resp.days > 0) {
      daysWindow = resp.days;
    }
    lastLoadedAt = Date.now();
    updateLastUpdatedLabel();
    const rawList = Array.isArray(resp.items) ? resp.items : (Array.isArray(resp.interactions) ? resp.interactions : []);
    cachedInteractions = rawList.map((item) => {
      if (item && (isMartinBrudePhone(item.wa_id) || isMartinBrudePhone(item.phone_formatted))) {
        return { ...item, patient_name: "Martín Brude" };
      }
      return item;
    });
    // No resetear página ni cerrar conversaciones abiertas en sync/auto-refresh.
    applyFilters(false);
    renderInteraccionesHealth(document.getElementById("interacciones-stats"), resp.health, resp.sync, {
      days: daysWindow,
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
    if (cachedInteractions.length === 0) {
      container.innerHTML = `<div class="interacciones-empty"><p>⚠️ Error al conectar con el servidor: ${escapeHtml(err.message || String(err))}</p></div>`;
    }
    if (refreshBtn && force) {
      refreshBtn.disabled = false;
      refreshBtn.style.opacity = "1";
      refreshBtn.innerHTML = `↻ Actualizar`;
    }
  } finally {
    isRefreshing = false;
    setListControlsEnabled(filterRoots, true);
  }
}

function applyFilters(resetPage = true) {
  const searchInput = document.getElementById("interacciones-search");
  filteredInteractions = filterInteractionsList(
    cachedInteractions,
    searchInput?.value,
    activeStatusFilter
  );

  if (resetPage) currentPage = 0;
  renderCurrentView();
  updateStatsHeader();
}

function updateStatsHeader() {
  const statsEl = document.getElementById("interacciones-stats");
  renderStatsHeader(statsEl, { cachedInteractions, activeStatusFilter });
}

function renderCurrentView() {
  const totalRows = filteredInteractions.length;
  const effectivePageSize = pageSize > 0 ? pageSize : 20;
  const totalPages = Math.max(1, Math.ceil(totalRows / effectivePageSize));

  currentPage = Math.min(Math.max(0, currentPage), totalPages - 1);
  const start = currentPage * effectivePageSize;
  const pagedItems = filteredInteractions.slice(start, start + effectivePageSize);

  renderInteractions(pagedItems);
  renderPager({
    totalRows,
    totalPages,
    currentPage,
    pageSize,
    onPageChange: (newPage) => {
      currentPage = newPage;
      renderCurrentView();
      document.getElementById("view-interacciones")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  });
}

function captureExpandedThreads(container) {
  if (!container) return;
  container.querySelectorAll(".interaccion-chat-thread").forEach((el) => {
    if (!el.id) return;
    if (el.hidden) expandedThreadIds.delete(el.id);
    else expandedThreadIds.add(el.id);
  });
}

function restoreExpandedThreads(container) {
  if (!container || expandedThreadIds.size === 0) return;
  expandedThreadIds.forEach((threadId) => {
    const threadEl = container.querySelector(`#${CSS.escape(threadId)}`);
    if (!threadEl) return;
    threadEl.hidden = false;
    const btn = container.querySelector(`[data-thread-toggle="${threadId.replace(/"/g, "")}"]`);
    const span = btn?.querySelector("span");
    if (span && span.textContent.includes("▶")) {
      span.textContent = span.textContent.replace("▶", "▼");
    }
  });
}

function renderInteractions(items) {
  const container = document.getElementById("interacciones-list-container");
  if (!container) return;

  captureExpandedThreads(container);

  if (!items || items.length === 0) {
    const windowLabel = daysWindow === 1 ? "último día" : `últimos ${daysWindow} días`;
    let emptyMsg = `No hay conversaciones en los ${windowLabel} con los filtros actuales.`;
    if (activeStatusFilter === "pending") {
      emptyMsg = `No hay pendientes de respuesta en los ${windowLabel}.`;
    } else if (activeStatusFilter === "answered") {
      emptyMsg = `No hay respondidas en los ${windowLabel}.`;
    } else if (activeStatusFilter === "archived") {
      emptyMsg = `No hay conversaciones archivadas en los ${windowLabel}.`;
    } else if (activeStatusFilter === "all") {
      emptyMsg = `No hay interacciones en los ${windowLabel}.`;
    }

    container.innerHTML = `
      <div class="interacciones-empty">
        <p>${escapeHtml(emptyMsg)}</p>
        ${activeStatusFilter !== "all" ? `<button type="button" class="btn secondary" id="btn-reset-status-filter" style="margin-top: 10px; font-size: 13px;">Mostrar todas</button>` : ""}
      </div>
    `;

    document.getElementById("btn-reset-status-filter")?.addEventListener("click", () => {
      activeStatusFilter = "all";
      applyFilters(true);
    });
    return;
  }

  const groups = {};
  items.forEach((item) => {
    const d = item.date || "Otras fechas";
    if (!groups[d]) groups[d] = [];
    groups[d].push(item);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  let html = "";

  sortedDates.forEach((dateKey) => {
    const groupItems = groups[dateKey];
    html += `
      <section class="interacciones-date-group">
        <div class="interacciones-date-header">
          <span>📅 ${escapeHtml(formatDateHeader(dateKey))}</span>
          <span class="interacciones-date-badge">${groupItems.length} ${groupItems.length === 1 ? "contacto" : "contactos"}</span>
        </div>
        <div class="interacciones-list">
    `;
    const currentUser = typeof getSessionUser === "function" ? getSessionUser() : null;
    groupItems.forEach((conv, itemIdx) => {
      html += buildInteractionCardHtml(conv, itemIdx, currentUser);
    });
    html += `</div></section>`;
  });

  container.innerHTML = html;
  restoreExpandedThreads(container);
  bindInteractionEvents(container, {
    getSessionUser,
    onThreadToggle: ({ threadId, isOpen }) => {
      if (!threadId) return;
      if (isOpen) expandedThreadIds.add(threadId);
      else expandedThreadIds.delete(threadId);
    },
    onArchive: async ({ convId, convName, isArchived }) => {
      if (getSessionUser()?.role === "colaborador") return;
      const q = isArchived
        ? `¿Desarchivar la conversación con "${convName}"? Volverá a la lista activa.`
        : `¿Archivar la conversación con "${convName}"? Se retirará de la lista activa.`;
      const ok = await dialogConfirm(q, {
        okText: isArchived ? "Desarchivar" : "Archivar",
        cancelText: "Cancelar"
      });
      if (!ok) return;

      const targetConv = cachedInteractions.find((i) => i.id === convId);
      if (targetConv) targetConv.archived = !isArchived;
      applyFilters(false);

      pendingMutations++;
      try {
        const resp = await api("interacciones.php", {
          method: "POST",
          body: JSON.stringify({ action: isArchived ? "unarchive" : "archive", id: convId }),
        });
        if (!resp || !resp.ok) throw new Error(resp?.error || "Error al actualizar archivo");
        toast(isArchived ? "Conversación desarchivada." : "Conversación archivada.", { type: "success" });
      } catch (err) {
        if (targetConv) targetConv.archived = isArchived;
        applyFilters(false);
        console.error("Error al archivar/desarchivar interacción:", err);
        toast(err?.message || "No se pudo actualizar el archivo.", { type: "danger" });
      } finally {
        pendingMutations = Math.max(0, pendingMutations - 1);
      }
    },
    onToggleAnswered: async ({ convId, convKey: _convKey, isChecked, chk, cardEl, pillEl }) => {
      if (getSessionUser()?.role === "colaborador") {
        if (chk) chk.checked = !isChecked;
        return;
      }
      const setVisualStatus = (ans) => {
        if (cardEl) cardEl.classList.toggle("is-answered", ans);
        if (pillEl) {
          pillEl.className = `interaccion-status-pill ${ans ? "answered" : "pending"}`;
          pillEl.textContent = ans ? "✓ Respondida" : "⏳ Pendiente";
        }
      };
      setVisualStatus(isChecked);

      const targetConv = cachedInteractions.find((i) => i.id === convId);
      if (targetConv) targetConv.answered = isChecked;

      if (activeStatusFilter !== "all") applyFilters(false);
      else updateStatsHeader();

      pendingMutations++;
      try {
        const resp = await api("interacciones.php", {
          method: "POST",
          body: JSON.stringify({ action: "toggle_answered", id: convId, answered: isChecked }),
        });
        if (!resp || !resp.ok) throw new Error(resp?.error || "Error al actualizar estado");
        toast(isChecked ? "Marcada como respondida." : "Marcada como pendiente.", { type: "success" });
      } catch (err) {
        chk.checked = !isChecked;
        setVisualStatus(!isChecked);
        if (targetConv) targetConv.answered = !isChecked;
        if (activeStatusFilter !== "all") applyFilters(false);
        else updateStatsHeader();
        console.error("Error al persistir consulta respondida:", err);
        toast(err?.message || "No se pudo actualizar el estado.", { type: "danger" });
      } finally {
        pendingMutations = Math.max(0, pendingMutations - 1);
      }
    },
  });
}

export function initInteraccionesModule() {
  const searchInput = document.getElementById("interacciones-search");
  const refreshBtn = document.getElementById("btn-refresh-interacciones");
  const pageSizeSelect = document.getElementById("interacciones-page-size");
  const daysSelect = document.getElementById("interacciones-days");
  const statsEl = document.getElementById("interacciones-stats");

  if (daysSelect) {
    daysWindow = Number(daysSelect.value) || 7;
    daysSelect.addEventListener("change", (e) => {
      daysWindow = Math.max(1, Math.min(90, Number(e.target.value) || 7));
      currentPage = 0;
      loadInteracciones(true);
    });
  }

  if (pageSizeSelect) {
    pageSize = Number(pageSizeSelect.value) || 20;
    pageSizeSelect.addEventListener("change", (e) => {
      if (isRefreshing) return;
      pageSize = Number(e.target.value) || 20;
      currentPage = 0;
      renderCurrentView();
    });
  }

  if (statsEl) {
    statsEl.addEventListener("click", (e) => {
      if (isRefreshing) return;
      const btn = e.target.closest(".filter-pill");
      if (!btn) return;
      const filterType = btn.getAttribute("data-filter");
      if (!filterType) return;
      activeStatusFilter = (activeStatusFilter === filterType) ? "all" : filterType;
      applyFilters(true);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (isRefreshing) return;
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
      Date.now() - lastLoadedAt >= AUTO_REFRESH_INTERVAL_MS
    ) {
      loadInteracciones(false);
    }
  };

  document.addEventListener("visibilitychange", triggerTabFocusRefresh);
  window.addEventListener("focus", triggerTabFocusRefresh);
}
