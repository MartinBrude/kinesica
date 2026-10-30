/**
 * Render de filas, encabezados de día y pager de Recordatorios.
 */

import { escapeHtml } from "./dom.js?v=78";

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
  const contact = viaEmail
    ? (item.error_message ? `Email: ${escapeHtml(item.error_message)}` : "Email")
    : `WhatsApp: ${item.wa_id ? escapeHtml(item.wa_id) : "—"}`;
  const reason = item.skip_reason_label
    ? `<span class="recordatorio-reason">${escapeHtml(item.skip_reason_label)}</span>`
    : "";
  const err =
    item.status === "failed" && (item.error_code || item.error_message)
      ? `<p class="recordatorio-error">${escapeHtml(
          [item.error_code, item.error_message].filter(Boolean).join(" — ")
        )}</p>`
      : "";
  const summary =
    item.event_summary && item.event_summary !== item.patient_name
      ? `<p class="recordatorio-summary">${escapeHtml(item.event_summary)}</p>`
      : "";

  return `<article class="recordatorio-card ${statusClass(item.status)}" data-id="${escapeHtml(item.id)}">
    <div class="recordatorio-card-main">
      <div class="recordatorio-card-title">
        <strong>${name}</strong>
        <span class="recordatorio-status-pill ${statusClass(item.status)}">${statusLabel}</span>
        ${reason}
      </div>
      ${summary}
      <div class="recordatorio-meta">
        <span>Turno: ${escapeHtml(appt)}</span>
        <span>${contact}</span>
        <span>Corrida: ${escapeHtml(item.run_at_local || item.run_at || "")}</span>
      </div>
      ${err}
    </div>
  </article>`;
}

export function renderRecordatoriosList(container, items) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="recordatorios-empty"><p>No hay recordatorios para mostrar con este filtro.</p></div>`;
    return;
  }
  const byDay = new Map();
  for (const item of items) {
    const day = item.run_day || "sin-fecha";
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(item);
  }
  const parts = [];
  for (const [day, list] of byDay) {
    parts.push(`<h2 class="recordatorios-day-header">${escapeHtml(formatRunDayHeader(day))}</h2>`);
    for (const item of list) {
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
