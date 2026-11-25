/**
 * Kinésica Admin — Modal para visualizar el mensaje de recordatorio enviado.
 */

import { escapeHtml, toast } from "./dom.js?v=79";
import { formatDisplayPhone } from "./phone-format.js?v=6";
import { capitalizePersonName } from "./pacientes-format.js";

/**
 * Obtiene el primer nombre o nombre de pila para el saludo personalizado.
 * @param {string} fullName
 * @returns {string}
 */
export function getPatientFirstName(fullName) {
  let name = String(fullName || "").trim();
  if (name.includes(",")) {
    const parts = name.split(",");
    if (parts[1] && parts[1].trim()) {
      name = parts[1].trim();
    }
  }
  const firstWord = name.split(/\s+/)[0] || name;
  return capitalizePersonName(firstWord) || "Estimado/a paciente";
}

/**
 * Formato de fecha amigable (ej: "miércoles 25 de noviembre").
 * @param {string} dateStr YYYY-MM-DD
 * @returns {string}
 */
export function formatFriendlyDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${dias[dt.getUTCDay()]} ${d} de ${meses[m]}`;
}

/**
 * Genera la frase temporal para el recordatorio (ej: "hoy miércoles 25 de noviembre a las 12:30 hs").
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} timeStr ej: "12:30 hs"
 * @returns {string}
 */
export function formatWhenPhrase(dateStr, timeStr) {
  let time = String(timeStr || "").trim();
  const isConvenir = !time || /convenir|convenido/i.test(time);
  if (isConvenir) {
    time = "horario a convenir";
  } else if (!/hs\b/i.test(time)) {
    time += " hs";
  }

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return isConvenir ? "en horario a convenir" : `a las ${time}`;
  }

  const now = new Date();
  const baOffset = -3 * 60; // UTC-3 Argentina
  const localUtc = now.getTime() + now.getTimezoneOffset() * 60000;
  const baNow = new Date(localUtc + baOffset * 60000);
  const todayKey = baNow.toISOString().slice(0, 10);

  const tomorrow = new Date(baNow.getTime() + 86400000);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);

  const friendly = formatFriendlyDate(dateStr);
  const timePart = isConvenir ? ` (${time})` : ` a las ${time}`;

  if (dateStr === todayKey) {
    return `hoy ${friendly}${timePart}`;
  }
  if (dateStr === tomorrowKey) {
    return `mañana ${friendly}${timePart}`;
  }
  return `el ${friendly}${timePart}`;
}

/**
 * Abre una ventana modal para visualizar el mensaje de recordatorio enviado al paciente.
 * @param {Object} item Datos del recordatorio
 */
export function openRecordatorioMessageModal(item) {
  if (!item) return;

  const backdrop = document.createElement("div");
  backdrop.className = "recordatorio-modal-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");

  const pName = item.patient_name ? capitalizePersonName(item.patient_name) : (item.event_summary || "Paciente");
  const firstName = getPatientFirstName(item.patient_name || item.event_summary);
  const appt = [item.appointment_date, item.appointment_time].filter(Boolean).join(" · ") || "Sin fecha/hora";
  const cuando = formatWhenPhrase(item.appointment_date, item.appointment_time);

  const summary = String(item.event_summary || "").toLowerCase();
  const desc = String(item.event_description || "").toLowerCase();
  const isCall =
    summary.includes("llamada") ||
    summary.includes("virtual") ||
    summary.includes("telefonica") ||
    summary.includes("telefónica") ||
    desc.includes("llamada") ||
    desc.includes("virtual");

  const tipoCita = isCall ? "llamada por WhatsApp" : "sesión en el consultorio";
  const indicaciones = isCall
    ? "Te llamaremos a la hora pactada directamente por WhatsApp."
    : "📍 Te esperamos en Charcas 3889, 5º, B (Palermo). ⚠️ Te recordamos que el espacio no cuenta con secretaria, por lo que te pedimos puntualidad estricta para evitar esperas en la entrada y no concurrir con acompañantes. Si tenés estudios médicos previos, no olvides traerlos.";

  const viaEmail = item.status === "sent_email";
  const effectiveWaId = item.wa_id || "";
  const rawDigits = String(effectiveWaId).replace(/\D/g, "");
  const waUrl = rawDigits ? `https://wa.me/${rawDigits}` : "";
  const displayPhone = effectiveWaId ? formatDisplayPhone(effectiveWaId) : "";
  const effectiveEmail = (item.email || (viaEmail && item.error_message ? item.error_message : "")).trim();

  // Texto del mensaje
  let plainMessageText = "";
  let messagePreviewHtml = "";

  if (viaEmail) {
    plainMessageText = `¡Hola ${firstName}!\n\nTe escribimos para recordarte tu turno:\n• Tipo: ${tipoCita}\n• Cuándo: ${cuando}\n• Ubicación: ${isCall ? "Llamada por WhatsApp" : "Charcas 3889, 5º, B (Palermo)"}\n\n${indicaciones}\n\nSi necesitás reprogramar o cancelar, por favor hacelo por WhatsApp.\nKinésica`;

    messagePreviewHtml = `
      <div class="recordatorio-email-preview">
        <div class="recordatorio-email-header">
          <div><strong>De:</strong> Kinésica &lt;info@kinesica.com.ar&gt;</div>
          <div><strong>Para:</strong> ${escapeHtml(effectiveEmail || "paciente")}</div>
          <div><strong>Asunto:</strong> Recordatorio de turno — Kinésica (${escapeHtml(cuando)})</div>
        </div>
        <div class="recordatorio-email-body">
          <p>¡Hola <strong>${escapeHtml(firstName)}</strong>!</p>
          <p>Te escribimos para recordarte tu turno:</p>
          <ul style="margin: 8px 0; padding-left: 20px;">
            <li><strong>Tipo:</strong> ${escapeHtml(tipoCita)}</li>
            <li><strong>Cuándo:</strong> ${escapeHtml(cuando)}</li>
            <li><strong>${isCall ? "Modalidad:" : "Ubicación:"}</strong> ${escapeHtml(isCall ? "Llamada por WhatsApp" : "Charcas 3889, 5º, B (Palermo)")}</li>
          </ul>
          <p style="margin-top: 10px;">${escapeHtml(indicaciones)}</p>
          <p style="margin-top: 14px; font-size: 12px; color: #64748b;">Si necesitás reprogramar o cancelar, por favor hacelo por WhatsApp.</p>
        </div>
      </div>
    `;
  } else {
    plainMessageText = `¡Hola ${firstName}! 🌿 Te escribo desde Kinésica para recordarte tu ${tipoCita} programada para ${cuando}.\n\n${indicaciones}\n\nPor favor confirmá tu asistencia seleccionando una de las opciones a continuación 🙌:\n[ Confirmar turno ]  [ Cancelar turno ]`;

    messagePreviewHtml = `
      <div class="recordatorio-wa-preview-container">
        <div class="recordatorio-wa-bubble">
          <div class="recordatorio-wa-text">¡Hola <strong>${escapeHtml(firstName)}</strong>! 🌿 Te escribo desde Kinésica para recordarte tu ${escapeHtml(tipoCita)} programada para <strong>${escapeHtml(cuando)}</strong>.<br><br>${escapeHtml(indicaciones)}<br><br>Por favor confirmá tu asistencia seleccionando una de las opciones a continuación 🙌:</div>
          <div class="recordatorio-wa-bubble-time">
            ${escapeHtml((item.run_at_local || "").split(" ")[1] || "")} <span class="wa-checkmarks" title="Entregado">✓✓</span>
          </div>
        </div>
        <div class="recordatorio-wa-buttons">
          <div class="recordatorio-wa-button-pill">
            <span>✅ Confirmar turno</span>
          </div>
          <div class="recordatorio-wa-button-pill">
            <span>❌ Cancelar turno</span>
          </div>
        </div>
      </div>
    `;
  }

  const channelBadge = viaEmail
    ? `<span class="recordatorio-channel-badge email">✉️ Correo electrónico</span>`
    : `<span class="recordatorio-channel-badge wa">💬 WhatsApp (Plantilla oficial Meta)</span>`;

  const sentTime = item.run_at_local || item.run_at || "—";
  const isSent = item.status === "sent" || item.status === "sent_email";
  const modalStatusTitle = isSent ? "Mensaje de recordatorio enviado" : "Vista previa del mensaje de recordatorio";

  backdrop.innerHTML = `
    <div class="recordatorio-modal-card recordatorio-message-modal-card">
      <div class="recordatorio-modal-header">
        <div class="recordatorio-message-title-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00a884" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <h3>${escapeHtml(modalStatusTitle)}</h3>
        </div>
        <button type="button" class="btn ghost btn-close-modal" aria-label="Cerrar">✕</button>
      </div>

      <div class="recordatorio-modal-body">
        <div class="recordatorio-modal-info">
          <div class="recordatorio-info-row">
            <div><strong>Paciente:</strong> ${escapeHtml(pName)}</div>
            <div><strong>Turno:</strong> ${escapeHtml(appt)}</div>
          </div>
          <div class="recordatorio-info-row" style="margin-top: 6px;">
            <div><strong>Canal:</strong> ${channelBadge}</div>
            ${
              displayPhone
                ? `<div><strong>Destino:</strong> <a href="${waUrl}" target="_blank" rel="noopener noreferrer" style="color:#00a884;text-decoration:none;font-weight:600;">💬 ${escapeHtml(displayPhone)}</a></div>`
                : effectiveEmail
                  ? `<div><strong>Destino:</strong> <a href="mailto:${encodeURIComponent(effectiveEmail)}" style="color:#0284c7;text-decoration:none;">✉️ ${escapeHtml(effectiveEmail)}</a></div>`
                  : ""
            }
          </div>
          ${
            isSent
              ? `<div style="margin-top: 6px; font-size: 12px; color: #166534;">
                   <strong>Registro de envío:</strong> ${escapeHtml(sentTime)}
                 </div>`
              : ""
          }
        </div>

        <div class="recordatorio-message-box-wrap">
          <div class="recordatorio-message-box-label">
            <span>Mensaje ${isSent ? "enviado" : "a enviar"}:</span>
          </div>
          ${messagePreviewHtml}
        </div>
      </div>

      <div class="recordatorio-modal-actions recordatorio-message-modal-actions">
        <button type="button" class="btn light" id="btn-copy-reminder-text">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>Copiar texto
        </button>
        <button type="button" class="btn green btn-close-modal">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const closeModal = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") closeModal();
  };

  backdrop.querySelectorAll(".btn-close-modal").forEach((btn) => {
    btn.addEventListener("click", closeModal);
  });

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  document.addEventListener("keydown", onKeyDown);

  const copyBtn = backdrop.querySelector("#btn-copy-reminder-text");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(plainMessageText);
        } else {
          const ta = document.createElement("textarea");
          ta.value = plainMessageText;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        copyBtn.innerHTML = `✓ ¡Copiado!`;
        copyBtn.classList.add("green");
        copyBtn.classList.remove("light");
        toast("Texto del mensaje copiado al portapapeles", "success");
        setTimeout(() => {
          copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>Copiar texto`;
          copyBtn.classList.remove("green");
          copyBtn.classList.add("light");
        }, 2000);
      } catch (err) {
        toast("No se pudo copiar el texto", "error");
      }
    });
  }
}
