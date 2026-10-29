/**
 * Kinésica Admin - Renderizado de Conversaciones WhatsApp
 * Genera el marcado para tarjetas de conversación, burbujas de chat, paginador y cabeceras de fecha.
 */

import { escapeHtml } from "./dom.js?v=78";
import { buildWhatsAppUrl } from "./interacciones-message.js";

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const DAY_NAMES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
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

export function renderChatMessages(messages, patientName) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return `<div style="text-align: center; font-size: 13px; color: var(--muted);">Sin mensajes registrados.</div>`;
  }

  return messages
    .filter((m) => m && typeof m === "object")
    .map((m) => {
      const isPatient = m.from === "patient";
      const bubbleClass = isPatient ? "chat-bubble-patient" : "chat-bubble-clara";
      const senderTitle = isPatient ? (String(patientName || "Paciente").trim() || "Paciente") : "🤖 Clara (Asistente Virtual)";
      const rawText = String(m.text || "");
      const formattedText = escapeHtml(rawText).replace(/\n/g, "<br>");

      return `
        <div class="chat-bubble ${bubbleClass}">
          <div class="chat-bubble-sender">${escapeHtml(senderTitle)}</div>
          <div class="chat-bubble-content">${formattedText}</div>
          <span class="chat-bubble-time">${escapeHtml(String(m.time || ""))}</span>
        </div>
      `;
    })
    .join("");
}

export function buildInteractionCardHtml(conv, itemIdx, senderName) {
  const cleanWa = String(conv?.wa_id || "").replace(/[^0-9]/g, "");
  const waUrl = buildWhatsAppUrl(cleanWa, senderName);
  const name = String(conv?.patient_name || "").trim() || "Paciente sin nombre";
  const phoneDisplay = String(conv?.phone_formatted || "").trim() || (cleanWa ? `+${cleanWa}` : "Sin teléfono");
  const timeStr = String(conv?.time || "").trim();
  const rawCategory = String(conv?.category_label || "Consulta WhatsApp");
  const categoryLabel = rawCategory.replace(/^[💬\s]+/, "");
  const summaryText = String(conv?.summary || "").trim() || "Consulta recibida";
  const convKey = String(conv?.id || `conv_${cleanWa || itemIdx}`).replace(/[^a-zA-Z0-9_-]/g, "_");
  const cardId = `conv-card-${convKey}`;
  const threadId = `thread-${convKey}`;
  const isAnswered = Boolean(conv?.answered);
  const initial = name !== "Paciente sin nombre" ? name.charAt(0).toUpperCase() : "👤";

  const isArchived = Boolean(conv?.archived);
  const archiveLabel = isArchived ? "Desarchivar conversación" : "Archivar conversación";

  return `
    <article class="interaccion-card ${isAnswered ? "is-answered" : ""} ${isArchived ? "is-archived" : ""}" id="${cardId}">
      <div class="interaccion-header">
        <div class="interaccion-user-info">
          <div class="interaccion-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
          <div class="interaccion-titles">
            <h3 class="interaccion-name">${escapeHtml(name)}</h3>
            <span class="interaccion-phone">
              📞 ${escapeHtml(phoneDisplay)} &bull; ${escapeHtml(timeStr)} hs
              <span class="interaccion-badge">${escapeHtml(categoryLabel)}</span>
              <span class="interaccion-status-pill ${isAnswered ? "answered" : "pending"}" id="status-pill-${convKey}">
                ${isAnswered ? "✓ Respondida" : "⏳ Pendiente"}
              </span>
            </span>
          </div>
        </div>

        <div class="interaccion-actions">
          <label class="interaccion-answered-label" title="Marcar si ya se le respondió al paciente">
            <input type="checkbox" class="interaccion-answered-checkbox" data-conv-id="${escapeHtml(conv?.id || convKey)}" data-conv-key="${convKey}" ${isAnswered ? "checked" : ""}>
            <span>Consulta respondida</span>
          </label>

          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-direct" data-wa-id="${cleanWa}" title="Abrir chat en WhatsApp">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.074-2.123-.518-1.745-.724-2.888-2.484-2.975-2.6-.088-.116-.708-.941-.708-1.792s.448-1.27.607-1.446c.159-.175.347-.219.462-.219.116 0 .232.001.332.006.106.005.249-.04.39.299.144.35.491 1.199.535 1.286.044.088.073.19.015.305-.058.116-.088.188-.174.29-.088.102-.185.228-.264.307-.089.088-.182.184-.078.362.103.179.462.763.992 1.236.684.609 1.26.798 1.439.887.179.088.283.073.388-.047.106-.119.454-.528.575-.709.121-.179.243-.151.409-.089.165.059 1.053.496 1.234.585.18.089.301.133.346.208.045.075.045.436-.099.841z"/>
            </svg>
            Abrir WhatsApp
          </a>

          <button type="button" class="btn-archive-interaction ${isArchived ? "is-archived" : ""}" data-conv-id="${escapeHtml(conv?.id || convKey)}" data-conv-name="${escapeHtml(name)}" data-archived="${isArchived ? "1" : "0"}" title="${archiveLabel}" aria-label="${archiveLabel}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="21 8 21 21 3 21 3 8"></polyline>
              <rect x="1" y="3" width="22" height="5"></rect>
              <line x1="10" y1="12" x2="14" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="interaccion-summary">
        <strong>Resumen de consulta:</strong> ${escapeHtml(summaryText)}
      </div>

      <button type="button" class="interaccion-toggle-btn" data-thread-toggle="${threadId}">
        <span>▶ Ver conversación completa (${Array.isArray(conv?.messages) ? conv.messages.length : 0} mensajes)</span>
      </button>

      <div class="interaccion-chat-thread" id="${threadId}" hidden>
        ${renderChatMessages(conv?.messages || [], name)}
      </div>
    </article>
  `;
}

export function renderPager({ totalRows, totalPages, currentPage, pageSize, onPageChange }) {
  const pagerEl = document.getElementById("interacciones-pager");
  if (!pagerEl) return;

  if (totalRows <= pageSize || totalRows === 0) {
    pagerEl.hidden = true;
    pagerEl.innerHTML = "";
    return;
  }

  pagerEl.hidden = false;
  pagerEl.innerHTML = "";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn ghost";
  prevBtn.textContent = "← Anterior";
  prevBtn.disabled = currentPage === 0;
  prevBtn.addEventListener("click", () => {
    if (currentPage > 0 && typeof onPageChange === "function") {
      onPageChange(currentPage - 1);
    }
  });

  const span = document.createElement("span");
  const unit = totalRows === 1 ? "conversación" : "conversaciones";
  span.textContent = `Página ${currentPage + 1} de ${totalPages} (${totalRows} ${unit})`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn ghost";
  nextBtn.textContent = "Siguiente →";
  nextBtn.disabled = currentPage >= totalPages - 1;
  nextBtn.addEventListener("click", () => {
    if (currentPage < totalPages - 1 && typeof onPageChange === "function") {
      onPageChange(currentPage + 1);
    }
  });

  pagerEl.append(prevBtn, span, nextBtn);
}

export function bindInteractionEvents(container, { onToggleAnswered, onArchive, getSessionUser }) {
  if (!container) return;
  container.querySelectorAll("[data-thread-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-thread-toggle");
      const threadEl = document.getElementById(targetId);
      if (!threadEl) return;
      threadEl.hidden = !threadEl.hidden;
      const span = btn.querySelector("span");
      if (span) {
        span.textContent = !threadEl.hidden ? span.textContent.replace("▶", "▼") : span.textContent.replace("▼", "▶");
      }
    });
  });

  container.querySelectorAll(".btn-whatsapp-direct").forEach((link) => {
    link.addEventListener("click", () => {
      const cleanWa = link.getAttribute("data-wa-id");
      if (cleanWa && typeof getSessionUser === "function") {
        link.href = buildWhatsAppUrl(cleanWa, getSessionUser());
      }
    });
  });

  container.querySelectorAll(".btn-archive-interaction").forEach((btn) => {
    btn.addEventListener("click", () => {
      const convId = btn.getAttribute("data-conv-id");
      const convName = btn.getAttribute("data-conv-name") || "este contacto";
      const isArchived = btn.getAttribute("data-archived") === "1";
      const cardEl = btn.closest(".interaccion-card");
      if (typeof onArchive === "function") {
        onArchive({ convId, convName, isArchived, btn, cardEl });
      }
    });
  });

  container.querySelectorAll(".interaccion-answered-checkbox").forEach((chk) => {
    chk.addEventListener("change", () => {
      const convId = chk.getAttribute("data-conv-id");
      const convKey = chk.getAttribute("data-conv-key") || convId;
      const isChecked = chk.checked;
      const cardEl = chk.closest(".interaccion-card");
      const pillEl = document.getElementById(`status-pill-${convKey}`);
      if (typeof onToggleAnswered === "function") {
        onToggleAnswered({ convId, convKey, isChecked, chk, cardEl, pillEl });
      }
    });
  });
}
