/**
 * Kinésica Admin - Módulo de Interacciones WhatsApp (Clara)
 * Muestra el historial cronológico de personas que le escribieron a Clara,
 * agrupadas por fecha, con su resumen de consulta y acceso directo para
 * abrir WhatsApp y responderles en un solo click.
 */

import { api } from "./api.js?v=77";
import { getSessionUser } from "./auth.js?v=81";
import { escapeHtml, switchActiveView, dialogConfirm, dialogAlert } from "./dom.js?v=78";
import {
  formatDateHeader,
  buildInteractionCardHtml,
  renderPager,
  bindInteractionEvents,
} from "./interacciones-render.js";
import { filterInteractionsList, renderStatsHeader } from "./interacciones-filter.js";

let cachedInteractions = [];
let filteredInteractions = [];
let currentPage = 0;
let pageSize = 20;
let activeStatusFilter = "all"; // "all" | "pending" | "answered"

export function showInteraccionesView() {
  const view = switchActiveView("view-interacciones");
  if (!view) return;

  try {
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "interacciones" }));
  } catch {}

  loadInteracciones();
}

export function hideInteraccionesView() {
  const view = document.getElementById("view-interacciones");
  if (view) view.hidden = true;
}

export async function loadInteracciones(force = false) {
  const container = document.getElementById("interacciones-list-container");
  if (!container) return;

  if (container.children.length === 0 || force) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);"><span class="loading-spinner"></span> Cargando conversaciones recientes...</div>`;
  }

  try {
    const resp = await api("interacciones.php");
    const isOk = Boolean(resp && (resp.ok === true || resp.status === "success" || Array.isArray(resp.items) || Array.isArray(resp.interactions)));
    if (!isOk) {
      container.innerHTML = `<div class="interacciones-empty"><p>⚠️ No se pudieron cargar las interacciones en este momento.</p></div>`;
      return;
    }
    cachedInteractions = Array.isArray(resp.items) ? resp.items : (Array.isArray(resp.interactions) ? resp.interactions : []);
    applyFilters(true);
  } catch (err) {
    container.innerHTML = `<div class="interacciones-empty"><p>⚠️ Error al conectar con el servidor: ${escapeHtml(err.message || String(err))}</p></div>`;
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

function renderInteractions(items) {
  const container = document.getElementById("interacciones-list-container");
  if (!container) return;

  if (!items || items.length === 0) {
    let emptyMsg = "No se encontraron conversaciones con los filtros actuales.";
    if (activeStatusFilter === "pending") emptyMsg = "No hay consultas pendientes de respuesta.";
    else if (activeStatusFilter === "answered") emptyMsg = "No hay consultas marcadas como respondidas.";
    else if (activeStatusFilter === "archived") emptyMsg = "No hay conversaciones archivadas.";

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
  bindInteractionEvents(container, {
    getSessionUser,
    onArchive: async ({ convId, convName, isArchived }) => {
      if (getSessionUser()?.role === "colaborador") {
        dialogAlert("Los usuarios con rol Colaborador tienen permisos de solo lectura.");
        return;
      }
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

      try {
        const resp = await api("interacciones.php", {
          method: "POST",
          body: JSON.stringify({ action: isArchived ? "unarchive" : "archive", id: convId }),
        });
        if (!resp || !resp.ok) throw new Error(resp?.error || "Error al actualizar archivo");
      } catch (err) {
        if (targetConv) targetConv.archived = isArchived;
        applyFilters(false);
        console.error("Error al archivar/desarchivar interacción:", err);
      }
    },
    onToggleAnswered: async ({ convId, convKey, isChecked, chk, cardEl, pillEl }) => {
      if (getSessionUser()?.role === "colaborador") {
        if (chk) chk.checked = !isChecked;
        dialogAlert("Los usuarios con rol Colaborador tienen permisos de solo lectura.");
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

      try {
        const resp = await api("interacciones.php", {
          method: "POST",
          body: JSON.stringify({ action: "toggle_answered", id: convId, answered: isChecked }),
        });
        if (!resp || !resp.ok) throw new Error(resp?.error || "Error al actualizar estado");
      } catch (err) {
        chk.checked = !isChecked;
        setVisualStatus(!isChecked);
        if (targetConv) targetConv.answered = !isChecked;
        if (activeStatusFilter !== "all") applyFilters(false);
        else updateStatsHeader();
        console.error("Error al persistir consulta respondida:", err);
      }
    },
  });
}

export function initInteraccionesModule() {
  const searchInput = document.getElementById("interacciones-search");
  const refreshBtn = document.getElementById("btn-refresh-interacciones");
  const pageSizeSelect = document.getElementById("interacciones-page-size");
  const statsEl = document.getElementById("interacciones-stats");

  if (pageSizeSelect) {
    pageSize = Number(pageSizeSelect.value) || 20;
    pageSizeSelect.addEventListener("change", (e) => {
      pageSize = Number(e.target.value) || 20;
      currentPage = 0;
      renderCurrentView();
    });
  }

  if (statsEl) {
    statsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-pill");
      if (!btn) return;
      const filterType = btn.getAttribute("data-filter");
      if (!filterType) return;
      activeStatusFilter = (activeStatusFilter === filterType) ? "all" : filterType;
      applyFilters(true);
    });
  }

  if (searchInput) searchInput.addEventListener("input", () => applyFilters(true));
  if (refreshBtn) refreshBtn.addEventListener("click", () => loadInteracciones(true));
}
