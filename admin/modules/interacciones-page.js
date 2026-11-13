import { api } from "./api.js?v=79";
import { escapeHtml, dialogConfirm, toast } from "./dom.js?v=79";
import { getSessionUser } from "./auth.js?v=83";
import {
  formatDateHeader,
  buildInteractionCardHtml,
  renderPager,
  bindInteractionEvents,
} from "./interacciones-render.js?v=4";
import { filterInteractionsList, renderStatsHeader } from "./interacciones-filter.js?v=2";
import {
  getCachedInteractions,
  setCachedInteractions,
  getFilteredInteractions,
  setFilteredInteractions,
  getCurrentPage,
  setCurrentPage,
  getPageSize,
  getDaysWindow,
  getActiveStatusFilter,
  setActiveStatusFilter,
  getExpandedThreadIds,
  bumpPendingMutations,
} from "./interacciones-state.js";
import { syncBadgeFromCache } from "./interacciones-badge.js";
import { captureExpandedThreads, restoreExpandedThreads } from "./interacciones-page-threads.js";

function renderInteractions(items) {
  const container = document.getElementById("interacciones-list-container");
  const cachedInteractions = getCachedInteractions();
  const activeStatusFilter = getActiveStatusFilter();
  const daysWindow = getDaysWindow();
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
      setActiveStatusFilter("all");
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
      const expandedThreadIds = getExpandedThreadIds();
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
        cancelText: "Cancelar",
      });
      if (!ok) return;

      const list = [...getCachedInteractions()];
      const targetConv = list.find((i) => i.id === convId);
      if (targetConv) targetConv.archived = !isArchived;
      setCachedInteractions(list);
      applyFilters(false);

      bumpPendingMutations(1);
      try {
        const resp = await api("interacciones.php", {
          method: "POST",
          body: JSON.stringify({ action: isArchived ? "unarchive" : "archive", id: convId }),
        });
        if (!resp || !resp.ok) throw new Error(resp?.error || "Error al actualizar archivo");
        toast(isArchived ? "Conversación desarchivada." : "Conversación archivada.", { type: "success" });
      } catch (err) {
        if (targetConv) targetConv.archived = isArchived;
        setCachedInteractions(list);
        applyFilters(false);
        console.error("Error al archivar/desarchivar interacción:", err);
        toast(err?.message || "No se pudo actualizar el archivo.", { type: "danger" });
      } finally {
        bumpPendingMutations(-1);
      }
    },
    onToggleAnswered: async ({ convId, isChecked, chk, cardEl, pillEl }) => {
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

      const list = [...getCachedInteractions()];
      const targetConv = list.find((i) => i.id === convId);
      if (targetConv) targetConv.answered = isChecked;
      setCachedInteractions(list);

      const activeStatusFilter = getActiveStatusFilter();
      if (activeStatusFilter !== "all") applyFilters(false);
      else updateStatsHeader();

      bumpPendingMutations(1);
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
        setCachedInteractions(list);
        if (activeStatusFilter !== "all") applyFilters(false);
        else updateStatsHeader();
        console.error("Error al persistir consulta respondida:", err);
        toast(err?.message || "No se pudo actualizar el estado.", { type: "danger" });
      } finally {
        bumpPendingMutations(-1);
      }
    },
  });
}

function updateStatsHeader() {
  const statsEl = document.getElementById("interacciones-stats");
  renderStatsHeader(statsEl, { cachedInteractions: getCachedInteractions(), activeStatusFilter: getActiveStatusFilter() });
  syncBadgeFromCache();
}

function renderCurrentView() {
  const filteredInteractions = getFilteredInteractions();
  const totalRows = filteredInteractions.length;
  const pageSize = getPageSize();
  const effectivePageSize = pageSize > 0 ? pageSize : 20;
  const totalPages = Math.max(1, Math.ceil(totalRows / effectivePageSize));

  let currentPage = getCurrentPage();
  currentPage = Math.min(Math.max(0, currentPage), totalPages - 1);
  setCurrentPage(currentPage);
  const start = currentPage * effectivePageSize;
  const pagedItems = filteredInteractions.slice(start, start + effectivePageSize);

  renderInteractions(pagedItems);
  renderPager({
    totalRows,
    totalPages,
    currentPage,
    pageSize,
    onPageChange: (newPage) => {
      setCurrentPage(newPage);
      renderCurrentView();
      document.getElementById("view-interacciones")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  });
}

export function applyFilters(resetPage = true) {
  const searchInput = document.getElementById("interacciones-search");
  setFilteredInteractions(filterInteractionsList(
    getCachedInteractions(),
    searchInput?.value,
    getActiveStatusFilter()
  ));

  if (resetPage) setCurrentPage(0);
  renderCurrentView();
  updateStatsHeader();
}
