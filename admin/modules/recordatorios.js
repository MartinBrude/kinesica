/**
 * Kinésica Admin — Historial de recordatorios WhatsApp 24h.
 */

import { api } from "./api.js?v=77";
import { switchActiveView } from "./dom.js?v=78";
import {
  renderRecordatoriosList,
  renderRecordatoriosPager,
} from "./recordatorios-render.js?v=1";
import {
  filterRecordatoriosList,
  renderRecordatoriosStats,
} from "./recordatorios-filter.js?v=1";
import { renderRecordatoriosRules } from "./recordatorios-rules.js?v=1";

let cachedItems = [];
let cachedCounts = {};
let filteredItems = [];
let currentPage = 0;
let pageSize = 20;
let activeStatusFilter = "all";
let autoRefreshTimer = null;
let isRefreshing = false;

export function showRecordatoriosView() {
  const view = switchActiveView("view-recordatorios");
  if (!view) return;
  try {
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "recordatorios" }));
  } catch {}
  renderRecordatoriosRules(document.getElementById("recordatorios-rules"));
  loadRecordatorios(true);
  startAutoRefresh();
}

export function hideRecordatoriosView() {
  const view = document.getElementById("view-recordatorios");
  if (view) view.hidden = true;
  stopAutoRefresh();
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = setInterval(() => {
    const view = document.getElementById("view-recordatorios");
    if (view && !view.hidden && document.visibilityState === "visible") {
      loadRecordatorios(false);
    }
  }, 30000);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

function applyFiltersAndRender() {
  const search = document.getElementById("recordatorios-search")?.value || "";
  filteredItems = filterRecordatoriosList(cachedItems, search, activeStatusFilter);
  const total = filteredItems.length;
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  if (currentPage > maxPage) currentPage = maxPage;
  const slice = filteredItems.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  renderRecordatoriosList(document.getElementById("recordatorios-list-container"), slice);
  renderRecordatoriosPager(document.getElementById("recordatorios-pager"), {
    currentPage,
    pageSize,
    total,
    onPageChange: (p) => {
      currentPage = p;
      applyFiltersAndRender();
    },
  });
  renderRecordatoriosStats(document.getElementById("recordatorios-stats"), {
    counts: cachedCounts,
    activeStatusFilter,
  });
  const totalEl = document.getElementById("recordatorios-total");
  if (totalEl) {
    totalEl.textContent = `${total} registro${total === 1 ? "" : "s"}`;
  }
}

function renderRecordatoriosSync(resp) {
  const el = document.getElementById("recordatorios-sync");
  if (!el) return;
  const sync = resp?.sync;
  const rec = resp?.reconcile && typeof resp.reconcile === "object" ? resp.reconcile : null;
  const status = (sync && sync.status) || (rec && rec.status) || "";
  const imported = sync && typeof sync.imported === "number" ? sync.imported : rec?.imported_last_run;
  const msg = (sync && sync.message) || (rec && rec.message) || "";
  if (!status && imported == null && !msg) {
    el.hidden = true;
    el.textContent = "";
    el.className = "recordatorios-sync";
    return;
  }
  const bits = [];
  if (status === "not_configured") {
    bits.push("Sync n8n: sin configurar");
  } else if (status === "busy") {
    bits.push("Sync n8n: en curso…");
  } else if (status === "partial") {
    bits.push("Sync n8n: parcial");
  } else if (status === "ok") {
    bits.push("Sync n8n: al día");
  } else if (status) {
    bits.push(`Sync n8n: ${status}`);
  }
  if (typeof imported === "number" && imported > 0) {
    bits.push(`+${imported} importado${imported === 1 ? "" : "s"}`);
  }
  if (msg && status !== "ok") {
    bits.push(msg);
  }
  el.textContent = bits.join(" · ");
  el.hidden = bits.length === 0;
  el.className = "recordatorios-sync" + (status === "partial" || status === "not_configured" ? " is-partial" : status === "ok" ? " is-ok" : "");
}

export async function loadRecordatorios(force = false) {
  const container = document.getElementById("recordatorios-list-container");
  const refreshBtn = document.getElementById("btn-refresh-recordatorios");
  if (!container || isRefreshing) return;
  isRefreshing = true;
  if (refreshBtn && force) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "↻ Actualizando...";
  }
  if (!container.children.length) {
    container.innerHTML = `<div class="recordatorios-empty"><p>Cargando recordatorios...</p></div>`;
  }
  try {
    const syncQ = force ? "&sync=1" : "";
    const resp = await api(`recordatorios.php?days=14${syncQ}&_t=${Date.now()}`, { cache: "no-store" });
    const ok = Boolean(resp && (resp.ok === true || resp.status === "success"));
    if (!ok) {
      if (!cachedItems.length) {
        container.innerHTML = `<div class="recordatorios-empty"><p>No se pudieron cargar los recordatorios.</p></div>`;
      }
      return;
    }
    cachedItems = Array.isArray(resp.items) ? resp.items : [];
    cachedCounts = resp.counts && typeof resp.counts === "object" ? resp.counts : {};
    renderRecordatoriosSync(resp);
    applyFiltersAndRender();
  } catch {
    if (!cachedItems.length) {
      container.innerHTML = `<div class="recordatorios-empty"><p>Error al cargar recordatorios.</p></div>`;
    }
  } finally {
    isRefreshing = false;
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "↻ Actualizar";
    }
  }
}

export function initRecordatoriosModule() {
  renderRecordatoriosRules(document.getElementById("recordatorios-rules"));
  document.getElementById("btn-refresh-recordatorios")?.addEventListener("click", () => {
    loadRecordatorios(true);
  });
  document.getElementById("recordatorios-search")?.addEventListener("input", () => {
    currentPage = 0;
    applyFiltersAndRender();
  });
  document.getElementById("recordatorios-page-size")?.addEventListener("change", (e) => {
    pageSize = Math.max(10, parseInt(e.target.value, 10) || 20);
    currentPage = 0;
    applyFiltersAndRender();
  });
  document.getElementById("recordatorios-stats")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    const next = btn.getAttribute("data-filter") || "all";
    activeStatusFilter = activeStatusFilter === next ? "all" : next;
    currentPage = 0;
    applyFiltersAndRender();
  });
}
