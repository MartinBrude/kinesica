import { escapeHtml } from "./dom.js?v=79";
import { buildRecordatorioCardHtml } from "./recordatorios-render-card.js?v=1";
import { formatRunDayHeader } from "./recordatorios-render-pages.js?v=1";

export function renderRecordatoriosList(container, items, state = {}) {
  if (!container) return;
  const list = Array.isArray(items) ? items : [];

  if (!list.length) {
    if (state.isLoading || (!state.hasLoadedOnce && state.isRefreshing)) {
      container.innerHTML = `
        <div class="recordatorios-empty is-loading">
          <span class="loading-spinner" aria-hidden="true"></span>
          <p>Cargando recordatorios...</p>
        </div>`;
      return;
    }

    const totalCached = typeof state.totalCached === "number" ? state.totalCached : 0;
    if (totalCached === 0) {
      const refreshNotice = state.isRefreshing
        ? `<p class="recordatorios-empty-refreshing"><span class="recordatorios-spinner-sm" aria-hidden="true"></span> Recargando datos desde el servidor…</p>`
        : "";
      container.innerHTML = `
        <div class="recordatorios-empty">
          <p>No hay recordatorios registrados en los últimos 14 días.</p>
          ${refreshNotice}
        </div>`;
      return;
    }

    let filterLabel = "con este filtro";
    if (state.activeStatusFilter === "pending") filterLabel = "pendientes de enviar (⏳ A enviar)";
    else if (state.activeStatusFilter === "sent") filterLabel = "enviados (✓ Enviados)";
    else if (state.activeStatusFilter === "failed") filterLabel = "que hayan fallado o sin teléfono (✕ Fallaron)";
    else if (state.activeStatusFilter === "skipped") filterLabel = "omitidos (⊘ Omitidos)";

    if (state.searchTerm) {
      filterLabel += ` que coincidan con "${escapeHtml(state.searchTerm)}"`;
    }

    const refreshNotice = state.isRefreshing
      ? `<p class="recordatorios-empty-refreshing"><span class="recordatorios-spinner-sm" aria-hidden="true"></span> Recargando datos desde el servidor…</p>`
      : "";

    container.innerHTML = `
      <div class="recordatorios-empty">
        <p>No se encontraron recordatorios ${filterLabel}.</p>
        ${refreshNotice}
        <div class="recordatorios-empty-actions">
          <button type="button" class="btn light btn-reset-recordatorios-filter" data-action="reset-filters">
            Restablecer filtros (ver todos: ${totalCached})
          </button>
        </div>
      </div>`;
    return;
  }

  const byDay = new Map();
  for (const item of list) {
    const day = item.run_day || "sin-fecha";
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(item);
  }
  const parts = [];
  for (const [day, dayList] of byDay) {
    parts.push(`<h2 class="recordatorios-day-header">${escapeHtml(formatRunDayHeader(day))}</h2>`);
    for (const item of dayList) {
      parts.push(buildRecordatorioCardHtml(item));
    }
  }
  container.innerHTML = parts.join("");
}

export function renderRecordatoriosPager(pagerEl, { currentPage, totalPages, pageLabel, onPageChange }) {
  if (!pagerEl) return;
  const pages = Math.max(1, Number(totalPages) || 1);
  if (pages <= 1) {
    pagerEl.hidden = true;
    pagerEl.innerHTML = "";
    return;
  }
  pagerEl.hidden = false;
  pagerEl.innerHTML = "";
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "btn ghost";
  prev.textContent = "← Anterior";
  prev.disabled = currentPage <= 0;
  prev.addEventListener("click", () => {
    if (currentPage > 0) onPageChange(currentPage - 1);
  });
  const span = document.createElement("span");
  const label = pageLabel ? ` · ${pageLabel}` : "";
  span.textContent = `Página ${currentPage + 1} de ${pages}${label}`;
  const next = document.createElement("button");
  next.type = "button";
  next.className = "btn ghost";
  next.textContent = "Siguiente →";
  next.disabled = currentPage >= pages - 1;
  next.addEventListener("click", () => {
    if (currentPage < pages - 1) onPageChange(currentPage + 1);
  });
  pagerEl.append(prev, span, next);
}
