import { escapeHtml } from "./dom.js?v=79";
import { buildWhatsAppUrl } from "./interacciones-message.js";
import { isMartinBrudePhone } from "./phone-search.js?v=3";
import { formatDisplayPhone } from "./phone-format.js";
import { capitalizePersonName } from "./pacientes-format.js";
import { parseBoolean } from "../ficha-rules.mjs?v=89";
import { renderAttachmentHtml } from "./interacciones-render-attachments.js";

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const DAY_NAMES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];

export function formatDateHeader(dateStr) {
  if (!dateStr || dateStr === "Otras fechas") return "Otras fechas";
  const str = String(dateStr).trim().slice(0, 10);
  const parts = str.split("-");
  if (parts.length !== 3) return String(dateStr);

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return String(dateStr);

  const dateObj = new Date(y, m, d);
  if (Number.isNaN(dateObj.getTime())) return String(dateStr);

  const dayName = DAY_NAMES[dateObj.getDay()] || "";
  const monthName = MONTH_NAMES[m] || "";

  const today = new Date();
  const isToday =
    today.getFullYear() === y &&
    today.getMonth() === m &&
    today.getDate() === d;

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === y &&
    yesterday.getMonth() === m &&
    yesterday.getDate() === d;

  let prefix = "";
  if (isToday) prefix = " (Hoy)";
  else if (isYesterday) prefix = " (Ayer)";

  return `${dayName} ${d} de ${monthName} de ${y}${prefix}`;
}

export function renderChatMessages(messages, patientName, waId = null) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return `<div style="text-align: center; font-size: 13px; color: var(--muted);">Sin mensajes registrados.</div>`;
  }

  const isMartin = isMartinBrudePhone(waId) || (patientName && String(patientName).toLowerCase().includes("martín brude"));
  const resolvedPatientName = isMartin ? "Martín Brude" : (String(patientName || "").trim() || "Paciente");

  return messages
    .filter((m) => m && typeof m === "object")
    .map((m) => {
      const isPatient = m.from === "patient";
      const bubbleClass = isPatient ? "chat-bubble-patient" : "chat-bubble-clara";
      const senderTitle = isPatient ? resolvedPatientName : "🤖 Clara (Asistente Virtual)";
      const rawText = String(m.text || "");
      const formattedText = escapeHtml(rawText).replace(/\n/g, "<br>");
      const attachmentHtml = renderAttachmentHtml(m.attachment);

      return `
        <div class="chat-bubble ${bubbleClass}">
          <div class="chat-bubble-sender">${escapeHtml(senderTitle)}</div>
          ${attachmentHtml}
          <div class="chat-bubble-content">${formattedText}</div>
          <span class="chat-bubble-time">${escapeHtml(String(m.time || ""))}</span>
        </div>
      `;
    })
    .join("");
}

export function buildInteractionCardHtml(conv, itemIdx, senderName) {
  const isInstagram = conv?.channel === "instagram" || String(conv?.wa_id || "").startsWith("ig_");
  const cleanWa = String(conv?.wa_id || "").replace(/[^0-9]/g, "");
  const waUrl = buildWhatsAppUrl(cleanWa, senderName);
  const isMartin = isMartinBrudePhone(cleanWa) || isMartinBrudePhone(conv?.phone_formatted);
  const rawName = String(conv?.patient_name || "").trim();
  const name = isMartin ? "Martín Brude" : (capitalizePersonName(rawName) || (isInstagram ? `@${String(conv?.wa_id || "").replace(/^ig_/, "")}` : "Paciente sin nombre"));
  const phoneDisplay = isInstagram
    ? (conv?.phone_formatted || `@${String(conv?.wa_id || "").replace(/^ig_/, "")}`)
    : ((conv?.phone_formatted ? formatDisplayPhone(conv.phone_formatted) : "") || (cleanWa ? formatDisplayPhone(cleanWa) : "Sin teléfono"));
  const timeStr = String(conv?.time || "").trim();
  const rawCategory = String(conv?.category_label || (isInstagram ? "📸 Instagram DM" : "Consulta WhatsApp"));
  const categoryLabel = rawCategory.replace(/^[💬\s]+/, "");
  const summaryText = String(conv?.summary || "").trim() || "Consulta recibida";
  const convKey = String(conv?.id || `conv_${cleanWa || itemIdx}`).replace(/[^a-zA-Z0-9_-]/g, "_");
  const cardId = `conv-card-${convKey}`;
  const threadId = `thread-${convKey}`;
  const isAnswered = parseBoolean(conv?.answered) === true;
  const hasAttachment = Boolean(conv?.has_attachment) || (Array.isArray(conv?.messages) && conv.messages.some((m) => m && m.attachment));
  const attachmentBadgeHtml = hasAttachment
    ? `<span class="interaccion-badge interaccion-badge-attachment" title="Contiene archivo adjunto">📎 Archivo adjunto</span>`
    : "";
  const initial = isInstagram ? "📸" : (name !== "Paciente sin nombre" ? name.charAt(0).toUpperCase() : "👤");

  const isArchived = parseBoolean(conv?.archived) === true;
  const archiveLabel = isArchived ? "Desarchivar conversación" : "Archivar conversación";
  const isColaborador = Boolean(typeof senderName === "object" && senderName?.role === "colaborador");
  const archiveBtnHtml = isColaborador
    ? ""
    : `<button type="button" class="btn-archive-interaction ${isArchived ? "is-archived" : ""}" data-conv-id="${escapeHtml(conv?.id || convKey)}" data-conv-name="${escapeHtml(name)}" data-archived="${isArchived ? "1" : "0"}" title="${archiveLabel}" aria-label="${archiveLabel}">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="21 8 21 21 3 21 3 8"></polyline>
        <rect x="1" y="3" width="22" height="5"></rect>
        <line x1="10" y1="12" x2="14" y2="12"></line>
      </svg>
    </button>`;

  const directActionBtnHtml = isInstagram
    ? `<a href="https://www.instagram.com/direct/inbox/" target="_blank" rel="noopener noreferrer" class="btn-instagram-direct" title="Abrir chat en Instagram Direct">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        Abrir Instagram
      </a>`
    : `<a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-direct" data-wa-id="${cleanWa}" title="Abrir chat en WhatsApp">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.074-2.123-.518-1.745-.724-2.888-2.484-2.975-2.6-.088-.116-.708-.941-.708-1.792s.448-1.27.607-1.446c.159-.175.347-.219.462-.219.116 0 .232.001.332.006.106.005.249-.04.39.299.144.35.491 1.199.535 1.286.044.088.073.19.015.305-.058.116-.088.188-.174.29-.088.102-.185.228-.264.307-.089.088-.182.184-.078.362.103.179.462.763.992 1.236.684.609 1.26.798 1.439.887.179.088.283.073.388-.047.106-.119.454-.528.575-.709.121-.179.243-.151.409-.089.165.059 1.053.496 1.234.585.18.089.301.133.346.208.045.075.045.436-.099.841z"/>
        </svg>
        Abrir WhatsApp
      </a>`;

  return `
    <article class="interaccion-card ${isAnswered ? "is-answered" : ""} ${isArchived ? "is-archived" : ""}" id="${cardId}">
      <div class="interaccion-header">
        <div class="interaccion-user-info">
          <div class="interaccion-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
          <div class="interaccion-titles">
            <h3 class="interaccion-name">${escapeHtml(name)}</h3>
            <span class="interaccion-phone">
              ${isInstagram ? "📸" : "📞"} ${escapeHtml(phoneDisplay)} &bull; ${escapeHtml(timeStr)} hs
              <span class="interaccion-badge ${isInstagram ? "interaccion-badge-instagram" : ""}">${escapeHtml(categoryLabel)}</span>
              ${attachmentBadgeHtml}
              <span class="interaccion-status-pill ${isAnswered ? "answered" : "pending"}" id="status-pill-${convKey}">
                ${isAnswered ? "✓ Respondida" : "⏳ Pendiente"}
              </span>
            </span>
          </div>
        </div>

        <div class="interaccion-actions">
          <label class="interaccion-answered-label" title="Marcar si ya se le respondió al paciente">
            <input type="checkbox" class="interaccion-answered-checkbox" data-conv-id="${escapeHtml(conv?.id || convKey)}" data-conv-key="${convKey}" ${isAnswered ? "checked" : ""} ${isColaborador ? 'disabled="disabled"' : ""}>
            <span>Consulta respondida</span>
          </label>

          ${directActionBtnHtml}

          ${archiveBtnHtml}
        </div>
      </div>

      <div class="interaccion-summary">
        <strong>Resumen de consulta:</strong> ${escapeHtml(summaryText)}
      </div>

      <button type="button" class="interaccion-toggle-btn" data-thread-toggle="${threadId}">
        <span>▶ Ver conversación completa (${Array.isArray(conv?.messages) ? conv.messages.length : 0} mensajes)</span>
      </button>

      <div class="interaccion-chat-thread" id="${threadId}" hidden>
        ${renderChatMessages(conv?.messages || [], name, cleanWa)}
      </div>
    </article>
  `;
}
