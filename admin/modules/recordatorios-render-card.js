import { escapeHtml } from "./dom.js?v=79";
import { formatDisplayPhone, extractPhoneCandidate, normalizePhoneForWhatsApp } from "./phone-format.js?v=7";
import { capitalizePersonName } from "./pacientes-format.js";
import { isAppointmentPast } from "./recordatorios-render-pages.js?v=1";

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

  const clockIcon = `<svg class="recordatorio-meta-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

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
      } catch { /* ignore */ }
    }
    const detectedStr = timeOnly ? ` · Detectado: ${escapeHtml(timeOnly)} hs` : "";
    return `${clockIcon}<span><span class="recordatorio-meta-label">Envío automático:</span> <strong>${escapeHtml(dispatchSchedule)}</strong>${detectedStr}</span>`;
  }

  if (item.status === "sent" || item.status === "sent_email") {
    return `${clockIcon}<span><span class="recordatorio-meta-label">Enviado:</span> <span class="recordatorio-meta-val">${escapeHtml(localTime)}</span></span>`;
  }

  if (item.status === "failed" || item.status === "missing_phone") {
    const alertIcon = `<svg class="recordatorio-meta-icon is-danger" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    return `${alertIcon}<span><span class="recordatorio-meta-label">Falló en ejecución:</span> <span class="recordatorio-meta-val">${escapeHtml(localTime)}</span></span>`;
  }

  return `${clockIcon}<span><span class="recordatorio-meta-label">Ejecución:</span> <span class="recordatorio-meta-val">${escapeHtml(localTime)}</span></span>`;
}

export function buildRecordatorioCardHtml(item) {
  const name = escapeHtml(item.patient_name ? capitalizePersonName(item.patient_name) : (item.event_summary || "—"));
  const statusLabel = escapeHtml(item.status_label || item.status || "");
  const appt =
    [item.appointment_date, item.appointment_time].filter(Boolean).join(" · ") || "—";
  const viaEmail = item.status === "sent_email";
  const hasEmail = !!(item.email && String(item.email).includes("@"));

  // Resolver wa_id con fallback desde descripción/summary (clave:valor telefono/whatsapp/…)
  let effectiveWaId = item.wa_id || "";
  if (!effectiveWaId) {
    const candidate =
      extractPhoneCandidate(item.event_description || "") ||
      extractPhoneCandidate(item.event_summary || "") ||
      extractPhoneCandidate(item.patient_name || "");
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
    const rawDigits = normalizePhoneForWhatsApp(effectiveWaId);
    const waUrl = rawDigits ? `https://wa.me/${rawDigits}` : "";
    const phoneFormatted = escapeHtml(formatDisplayPhone(effectiveWaId));
    if (waUrl) {
      contactBits.push(`<a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="recordatorio-contact-link recordatorio-wa-link" title="Abrir chat en WhatsApp">💬 ${phoneFormatted}</a>`);
    } else {
      contactBits.push(`<span>${phoneFormatted}</span>`);
    }
  }
  const effectiveEmail = (hasEmail ? item.email : (viaEmail && item.error_message ? item.error_message : "")).trim();
  if (effectiveEmail && effectiveEmail.includes("@")) {
    const mailtoUrl = `mailto:${encodeURIComponent(effectiveEmail)}`;
    const emailEscaped = escapeHtml(item.email);
    contactBits.push(`<a href="${mailtoUrl}" class="recordatorio-contact-link recordatorio-email-link" title="Enviar correo">✉️ ${emailEscaped}</a>`);
  }
  const contact = contactBits.length
    ? `<div class="recordatorio-contact-group">${contactBits.join("")}</div>`
    : `<span class="recordatorio-contact-warning">⚠️ Sin contacto registrado</span>`;

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

  // Ocultar resumen si solo repite el nombre del paciente, etiquetas de turno y/o su teléfono
  const displaySummary = (() => {
    const rawSummary = String(item.event_summary || "").trim();
    if (!rawSummary) return "";
    const pName = String(item.patient_name || "").trim();
    if (rawSummary === pName) return "";

    // Eliminar etiquetas entre corchetes ([NORBERTO], [TURNO]), emojis iniciales
    let clean = rawSummary.replace(/\[[^\]]*\]/g, "").replace(/^[^\wáéíóúÁÉÍÓÚñÑüÜ]+/g, "").trim();

    // Eliminar dígitos del teléfono si está presente
    if (effectiveWaId) {
      const rawDigits = String(effectiveWaId).replace(/\D/g, "");
      if (rawDigits.length >= 8) {
        clean = clean.replace(new RegExp(rawDigits.slice(-8), "g"), "");
      }
    }
    // Dejar solo texto
    const textOnly = clean.replace(/[0-9\+\-\(\)\s]+/g, " ").trim();
    if (!textOnly || textOnly.toLowerCase() === pName.toLowerCase()) {
      return "";
    }
    return rawSummary;
  })();

  const summary = displaySummary
    ? `<p class="recordatorio-summary">${escapeHtml(displaySummary)}</p>`
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
  actions.push(`
      <button type="button" class="btn light btn-view-message ${alreadySent ? 'is-sent' : ''}" data-action="view-message" data-id="${escapeHtml(item.id)}" title="${alreadySent ? 'Ver mensaje enviado' : 'Ver mensaje de recordatorio'}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px;margin-right:4px;">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>Ver mensaje
      </button>`);
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
        <div class="recordatorio-meta-item meta-turno">
          <svg class="recordatorio-meta-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span class="recordatorio-meta-label">Turno:</span>
          <span class="recordatorio-turno-val">${escapeHtml(appt)}</span>
        </div>
        <span class="recordatorio-meta-divider" aria-hidden="true"></span>
        <div class="recordatorio-meta-item meta-contacto">
          ${contact}
        </div>
        <span class="recordatorio-meta-divider" aria-hidden="true"></span>
        <div class="recordatorio-meta-item meta-timing">
          ${getTimingMetaHtml(item)}
        </div>
      </div>
      ${err}
    </div>
    ${actionBtn}
  </article>`;
}
