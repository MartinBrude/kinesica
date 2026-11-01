/**
 * Render de filas, encabezados de día y pager de Recordatorios.
 */

import { escapeHtml } from "./dom.js?v=78";
import { formatDisplayPhone } from "./phone-format.js";

export function formatRunDayHeader(isoDay) {
  if (!isoDay || isoDay === "sin-fecha") return "Sin fecha";
  try {
    const [y, m, d] = isoDay.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoDay;
  }
}

function statusClass(status) {
  if (status === "pending") return "is-pending";
  if (status === "sent" || status === "sent_email") return "is-sent";
  if (status === "failed") return "is-failed";
  if (status === "missing_phone") return "is-phone";
  if (status === "run_skipped" || status === "skipped") return "is-skipped";
  return "";
}

export function buildRecordatorioCardHtml(item) {
  const name = escapeHtml(item.patient_name || item.event_summary || "—");
  const statusLabel = escapeHtml(item.status_label || item.status || "");
  const appt =
    [item.appointment_date, item.appointment_time].filter(Boolean).join(" · ") || "—";
  const viaEmail = item.status === "sent_email";
  const isMissingPhone = !item.wa_id && !viaEmail && item.status !== "skipped" && item.status !== "run_skipped";

  const contact = viaEmail
    ? (item.error_message ? `Email: ${escapeHtml(item.error_message)}` : "Email")
    : (item.wa_id
        ? `WhatsApp: ${escapeHtml(formatDisplayPhone(item.wa_id))}`
        : `<span class="recordatorio-contact-warning">⚠️ Sin WhatsApp registrado</span>`);

  const warningPill = isMissingPhone && item.status === "pending"
    ? `<span class="recordatorio-warning-pill" title="No figura teléfono en el turno ni en el directorio">⚠️ Falta teléfono</span>`
    : "";

  const reason = item.skip_reason_label
    ? `<span class="recordatorio-reason">${escapeHtml(item.skip_reason_label)}</span>`
    : "";
  const err =
    (item.status === "failed" || item.status === "missing_phone") && (item.error_code || item.error_message)
      ? `<p class="recordatorio-error">${escapeHtml(
          [item.error_code, item.error_message].filter(Boolean).join(" — ")
        )}</p>`
      : (isMissingPhone && item.status === "pending"
          ? `<p class="recordatorio-warning-text">⚠️ No se encontró número de WhatsApp para este paciente. Podés cargarlo antes de la corrida o usar <em>⚡ Enviar ahora</em> para ingresarlo manualmente.</p>`
          : "");
  const summary =
    item.event_summary && item.event_summary !== item.patient_name
      ? `<p class="recordatorio-summary">${escapeHtml(item.event_summary)}</p>`
      : "";

  let actionBtn = "";
  if (item.status === "failed" || item.status === "missing_phone") {
    actionBtn = `
      <div class="recordatorio-card-actions">
        <button type="button" class="btn light btn-trigger-recordatorio is-failed" data-action="dispatch-manual" data-id="${escapeHtml(item.id)}" title="Disparar recordatorio manualmente">
          ⚡ Disparar manualmente
        </button>
      </div>`;
  } else if (item.status === "pending") {
    actionBtn = `
      <div class="recordatorio-card-actions">
        <button type="button" class="btn light btn-trigger-recordatorio is-pending" data-action="dispatch-manual" data-id="${escapeHtml(item.id)}" title="Enviar recordatorio ahora">
          ⚡ Enviar ahora
        </button>
      </div>`;
  }

  const phoneCardClass = isMissingPhone && item.status === "pending" ? "is-missing-contact" : "";

  return `<article class="recordatorio-card ${statusClass(item.status)} ${phoneCardClass}" data-id="${escapeHtml(item.id)}">
    <div class="recordatorio-card-main">
      <div class="recordatorio-card-title">
        <strong>${name}</strong>
        <span class="recordatorio-status-pill ${statusClass(item.status)}">${statusLabel}</span>
        ${warningPill}
        ${reason}
      </div>
      ${summary}
      <div class="recordatorio-meta">
        <span>Turno: ${escapeHtml(appt)}</span>
        <span>${contact}</span>
        <span>${item.status === "pending" ? "Programado" : "Corrida"}: ${escapeHtml(item.run_at_local || item.run_at || "")}</span>
      </div>
      ${err}
    </div>
    ${actionBtn}
  </article>`;
}

export function renderRecordatoriosList(container, items, state = {}) {
  if (!container) return;
  const list = Array.isArray(items) ? items : [];

  if (!list.length) {
    if (state.isLoading || (!state.hasLoadedOnce && state.isRefreshing)) {
      container.innerHTML = `
        <div class="recordatorios-empty is-loading">
          <span class="recordatorios-spinner" aria-hidden="true"></span>
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

export function renderRecordatoriosPager(pagerEl, { currentPage, pageSize, total, onPageChange }) {
  if (!pagerEl) return;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
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
  span.textContent = `Página ${currentPage + 1} de ${totalPages}`;
  const next = document.createElement("button");
  next.type = "button";
  next.className = "btn ghost";
  next.textContent = "Siguiente →";
  next.disabled = currentPage >= totalPages - 1;
  next.addEventListener("click", () => {
    if (currentPage < totalPages - 1) onPageChange(currentPage + 1);
  });
  pagerEl.append(prev, span, next);
}
