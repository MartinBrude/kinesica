/**
 * Render de filas, encabezados de día y pager de Recordatorios.
 */

import { escapeHtml } from "./dom.js?v=78";
import { formatDisplayPhone, extractPhoneCandidate } from "./phone-format.js";

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

export function isAppointmentPast(apptDate, apptTime) {
  if (!apptDate) return false;
  let timeStr = "23:59:59";
  if (apptTime) {
    const m = String(apptTime).match(/(\d{1,2}):(\d{2})/);
    if (m) {
      timeStr = m[1].padStart(2, "0") + ":" + m[2] + ":00";
    }
  }
  // Buenos Aires es UTC-3 sin horario de verano
  const isoStr = apptDate + "T" + timeStr + "-03:00";
  const apptDt = new Date(isoStr);
  if (Number.isNaN(apptDt.getTime())) return false;
  return apptDt.getTime() < Date.now();
}

function statusClass(status) {
  if (status === "pending") return "is-pending";
  if (status === "sent" || status === "sent_email") return "is-sent";
  if (status === "failed") return "is-failed";
  if (status === "missing_phone") return "is-phone";
  if (status === "run_skipped" || status === "skipped") return "is-skipped";
  return "";
}

function getTimingMetaHtml(item) {
  const localTime = item.run_at_local || item.run_at || "";
  const timeOnly = localTime ? localTime.split(" ")[1] || localTime : "";

  if (item.status === "pending") {
    let dispatchSchedule = "Hoy 18:00 hs";
    if (item.appointment_date) {
      try {
        const [y, m, d] = item.appointment_date.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        const dayOfWeek = dt.getDay(); // 0: Dom, 1: Lun, 2: Mar, 3: Mie, 4: Jue, 5: Vie, 6: Sab
        if (dayOfWeek === 1) {
          dispatchSchedule = "Domingo 18:00 hs";
        } else if (dayOfWeek >= 2 && dayOfWeek <= 5) {
          dispatchSchedule = "Día previo 10:00 hs";
        }
      } catch {}
    }
    const detectedStr = timeOnly ? ` · Detectado: ${escapeHtml(timeOnly)} hs` : "";
    return `<span>Envío automático: <strong>${escapeHtml(dispatchSchedule)}</strong>${detectedStr}</span>`;
  }

  if (item.status === "sent" || item.status === "sent_email") {
    return `<span>Enviado: ${escapeHtml(localTime)}</span>`;
  }

  if (item.status === "failed" || item.status === "missing_phone") {
    return `<span>Falló en ejecución: ${escapeHtml(localTime)}</span>`;
  }

  return `<span>Ejecución: ${escapeHtml(localTime)}</span>`;
}

export function buildRecordatorioCardHtml(item) {
  const name = escapeHtml(item.patient_name || item.event_summary || "—");
  const statusLabel = escapeHtml(item.status_label || item.status || "");
  const appt =
    [item.appointment_date, item.appointment_time].filter(Boolean).join(" · ") || "—";
  const viaEmail = item.status === "sent_email";
  const hasEmail = !!(item.email && String(item.email).includes("@"));

  // Resolver wa_id con fallback si vino vacío pero está en event_summary o patient_name
  let effectiveWaId = item.wa_id || "";
  if (!effectiveWaId) {
    const candidate = extractPhoneCandidate(item.event_summary || "") || extractPhoneCandidate(item.patient_name || "");
    if (candidate) {
      effectiveWaId = candidate;
    }
  }

  const isMissingPhone =
    !effectiveWaId && !viaEmail && item.status !== "run_skipped";
  const needsContact =
    !effectiveWaId &&
    ["pending", "missing_phone", "failed", "skipped"].includes(String(item.status || ""));

  const contactBits = [];
  if (effectiveWaId) {
    contactBits.push(`WhatsApp: ${escapeHtml(formatDisplayPhone(effectiveWaId))}`);
  }
  if (hasEmail) {
    contactBits.push(`Email: ${escapeHtml(item.email)}`);
  } else if (viaEmail && item.error_message) {
    contactBits.push(`Email: ${escapeHtml(item.error_message)}`);
  }
  const contact = contactBits.length
    ? contactBits.join(" · ")
    : `<span class="recordatorio-contact-warning">⚠️ Sin WhatsApp ni email registrados</span>`;

  const warningPill = isMissingPhone && (item.status === "pending" || item.status === "missing_phone")
    ? `<span class="recordatorio-warning-pill" title="No figura teléfono en el turno ni en el directorio">⚠️ Falta teléfono</span>`
    : "";

  const reason = item.skip_reason_label
    ? `<span class="recordatorio-reason">${escapeHtml(item.skip_reason_label)}</span>`
    : "";
  const showRawError =
    (item.status === "failed" || item.status === "missing_phone") &&
    (item.error_code || item.error_message) &&
    !String(item.error_message || "").startsWith("contact_email:");
  const err = showRawError
    ? `<p class="recordatorio-error">${escapeHtml(
        [item.error_code, item.error_message].filter(Boolean).join(" — ")
      )}</p>`
    : isMissingPhone && (item.status === "pending" || item.status === "missing_phone")
      ? `<p class="recordatorio-warning-text">⚠️ No se encontró número de WhatsApp para este paciente. Usá <em>＋ Cargar contacto</em> para cargar teléfono y/o email.</p>`
      : "";
  const summary =
    item.event_summary && item.event_summary !== item.patient_name
      ? `<p class="recordatorio-summary">${escapeHtml(item.event_summary)}</p>`
      : "";

  const isPast = isAppointmentPast(item.appointment_date, item.appointment_time);
  const alreadySent = item.status === "sent" || item.status === "sent_email";
  const hasPhone = !!effectiveWaId;
  // Enviar manual solo si hay WhatsApp o email, aún no se envió y el turno NO expiró / ya pasó.
  // Sin contacto: solo «Cargar contacto» (el envío no tiene sentido).
  const canManualSend =
    !alreadySent &&
    !isPast &&
    item.status !== "run_skipped" &&
    (hasPhone || hasEmail);

  const actions = [];
  if (needsContact) {
    actions.push(`
        <button type="button" class="btn light btn-load-contact" data-action="save-contact" data-id="${escapeHtml(item.id)}" title="Cargar teléfono y/o email en el directorio">
          ＋ Cargar contacto
        </button>`);
  }
  if (canManualSend) {
    const isRetry = item.status === "failed" || item.status === "missing_phone";
    const sendLabel = isRetry ? "⚡ Disparar manualmente" : "⚡ Enviar ahora";
    const sendClass = isRetry ? "is-failed" : "is-pending";
    actions.push(`
        <button type="button" class="btn light btn-trigger-recordatorio ${sendClass}" data-action="dispatch-manual" data-id="${escapeHtml(item.id)}" title="Enviar recordatorio ahora por WhatsApp o email">
          ${sendLabel}
        </button>`);
  }
  const actionBtn = actions.length
    ? `<div class="recordatorio-card-actions">${actions.join("")}</div>`
    : "";

  const phoneCardClass =
    isMissingPhone && (item.status === "pending" || item.status === "missing_phone")
      ? "is-missing-contact"
      : "";

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
        ${getTimingMetaHtml(item)}
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
