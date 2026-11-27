/**
 * Modal para visualizar el mensaje de recordatorio (enviado o a enviar).
 * La frase temporal viene del backend (`when_phrase`) — no se reimplementa acá.
 */

import { escapeHtml, toast } from "./dom.js?v=79";
import { formatDisplayPhone, normalizePhoneForWhatsApp } from "./phone-format.js?v=8";
import { capitalizePersonName } from "./pacientes-format.js";

const COPY_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

/** Saludo breve a partir del nombre del turno (no confundir con getPatientFirstName de pacientes). */
function reminderGreetingName(fullName) {
  let name = String(fullName || "").trim();
  if (name.includes(",")) {
    const parts = name.split(",");
    if (parts[1]?.trim()) name = parts[1].trim();
  }
  return capitalizePersonName(name.split(/\s+/)[0] || name) || "Estimado/a paciente";
}

function isCallAppointment(item) {
  const blob = `${item.event_summary || ""} ${item.event_description || ""}`.toLowerCase();
  return /llamada|virtual|telefonica|telefónica/.test(blob);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

/**
 * @param {Object} item Datos del recordatorio (incluye when_phrase del API)
 */
export function openRecordatorioMessageModal(item) {
  if (!item) return;

  const pName = item.patient_name
    ? capitalizePersonName(item.patient_name)
    : item.event_summary || "Paciente";
  const firstName = reminderGreetingName(item.patient_name || item.event_summary);
  const appt = [item.appointment_date, item.appointment_time].filter(Boolean).join(" · ") || "Sin fecha/hora";
  const cuando =
    String(item.when_phrase || "").trim() ||
    [item.appointment_date, item.appointment_time].filter(Boolean).join(" ") ||
    "horario a confirmar";

  const call = isCallAppointment(item);
  const tipoCita = call ? "llamada por WhatsApp" : "sesión en el consultorio";
  const indicaciones = call
    ? "Te llamaremos a la hora pactada directamente por WhatsApp."
    : "📍 Te esperamos en Charcas 3889, 5º, B (Palermo). ⚠️ Te recordamos que el espacio no cuenta con secretaria, por lo que te pedimos puntualidad estricta para evitar esperas en la entrada y no concurrir con acompañantes. Si tenés estudios médicos previos, no olvides traerlos.";

  const viaEmail = item.status === "sent_email";
  const rawDigits = normalizePhoneForWhatsApp(item.wa_id || "");
  const waUrl = rawDigits ? `https://wa.me/${rawDigits}` : "";
  const displayPhone = item.wa_id ? formatDisplayPhone(item.wa_id) : "";
  const effectiveEmail = (
    item.email || (viaEmail && item.error_message ? item.error_message : "")
  ).trim();

  let plainMessageText = "";
  let messagePreviewHtml = "";

  if (viaEmail) {
    plainMessageText = `¡Hola ${firstName}!\n\nTe escribimos para recordarte tu turno:\n• Tipo: ${tipoCita}\n• Cuándo: ${cuando}\n• Ubicación: ${call ? "Llamada por WhatsApp" : "Charcas 3889, 5º, B (Palermo)"}\n\n${indicaciones}\n\nSi necesitás reprogramar o cancelar, por favor hacelo por WhatsApp.\nKinésica`;
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
          <ul>
            <li><strong>Tipo:</strong> ${escapeHtml(tipoCita)}</li>
            <li><strong>Cuándo:</strong> ${escapeHtml(cuando)}</li>
            <li><strong>${call ? "Modalidad:" : "Ubicación:"}</strong> ${escapeHtml(call ? "Llamada por WhatsApp" : "Charcas 3889, 5º, B (Palermo)")}</li>
          </ul>
          <p class="recordatorio-email-indicaciones">${escapeHtml(indicaciones)}</p>
          <p class="recordatorio-email-footer">Si necesitás reprogramar o cancelar, por favor hacelo por WhatsApp.</p>
        </div>
      </div>`;
  } else {
    plainMessageText = `¡Hola ${firstName}! 🌿 Te escribo desde Kinésica para recordarte tu ${tipoCita} programada para ${cuando}.\n\n${indicaciones}\n\nPor favor confirmá tu asistencia seleccionando una de las opciones a continuación 🙌:\n[ Confirmar turno ]  [ Cancelar turno ]`;
    const sentClock = escapeHtml((item.run_at_local || "").split(" ")[1] || "");
    messagePreviewHtml = `
      <div class="recordatorio-wa-preview-container">
        <div class="recordatorio-wa-bubble">
          <div class="recordatorio-wa-text">¡Hola <strong>${escapeHtml(firstName)}</strong>! 🌿 Te escribo desde Kinésica para recordarte tu ${escapeHtml(tipoCita)} programada para <strong>${escapeHtml(cuando)}</strong>.<br><br>${escapeHtml(indicaciones)}<br><br>Por favor confirmá tu asistencia seleccionando una de las opciones a continuación 🙌:</div>
          <div class="recordatorio-wa-bubble-time">${sentClock} <span class="wa-checkmarks" title="Entregado">✓✓</span></div>
        </div>
        <div class="recordatorio-wa-buttons">
          <div class="recordatorio-wa-button-pill"><span>✅ Confirmar turno</span></div>
          <div class="recordatorio-wa-button-pill"><span>❌ Cancelar turno</span></div>
        </div>
      </div>`;
  }

  const channelBadge = viaEmail
    ? `<span class="recordatorio-channel-badge email">✉️ Correo electrónico</span>`
    : `<span class="recordatorio-channel-badge wa">💬 WhatsApp (Plantilla oficial Meta)</span>`;

  const isSent = item.status === "sent" || item.status === "sent_email";
  const destino = displayPhone
    ? `<div><strong>Destino:</strong> <a class="recordatorio-destino-wa" href="${waUrl}" target="_blank" rel="noopener noreferrer">💬 ${escapeHtml(displayPhone)}</a></div>`
    : effectiveEmail
      ? `<div><strong>Destino:</strong> <a class="recordatorio-destino-mail" href="mailto:${encodeURIComponent(effectiveEmail)}">✉️ ${escapeHtml(effectiveEmail)}</a></div>`
      : "";

  const backdrop = document.createElement("div");
  backdrop.className = "recordatorio-modal-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.innerHTML = `
    <div class="recordatorio-modal-card recordatorio-message-modal-card">
      <div class="recordatorio-modal-header">
        <div class="recordatorio-message-title-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00a884" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <h3>${escapeHtml(isSent ? "Mensaje de recordatorio enviado" : "Vista previa del mensaje de recordatorio")}</h3>
        </div>
        <button type="button" class="btn ghost btn-close-modal" aria-label="Cerrar">✕</button>
      </div>
      <div class="recordatorio-modal-body">
        <div class="recordatorio-modal-info">
          <div class="recordatorio-info-row">
            <div><strong>Paciente:</strong> ${escapeHtml(pName)}</div>
            <div><strong>Turno:</strong> ${escapeHtml(appt)}</div>
          </div>
          <div class="recordatorio-info-row recordatorio-info-row-gap">
            <div><strong>Canal:</strong> ${channelBadge}</div>
            ${destino}
          </div>
          ${
            isSent
              ? `<div class="recordatorio-envio-meta"><strong>Registro de envío:</strong> ${escapeHtml(item.run_at_local || item.run_at || "—")}</div>`
              : ""
          }
        </div>
        <div class="recordatorio-message-box-wrap">
          <div class="recordatorio-message-box-label"><span>Mensaje ${isSent ? "enviado" : "a enviar"}:</span></div>
          ${messagePreviewHtml}
        </div>
      </div>
      <div class="recordatorio-modal-actions recordatorio-message-modal-actions">
        <button type="button" class="btn light" id="btn-copy-reminder-text">${COPY_ICON}Copiar texto</button>
        <button type="button" class="btn green btn-close-modal">Cerrar</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  const closeModal = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
  };
  const onKeyDown = (e) => {
    if (e.key === "Escape") closeModal();
  };

  backdrop.querySelectorAll(".btn-close-modal").forEach((btn) => btn.addEventListener("click", closeModal));
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener("keydown", onKeyDown);

  const copyBtn = backdrop.querySelector("#btn-copy-reminder-text");
  copyBtn?.addEventListener("click", async () => {
    try {
      await copyText(plainMessageText);
      copyBtn.innerHTML = "✓ ¡Copiado!";
      copyBtn.classList.replace("light", "green");
      toast("Texto del mensaje copiado al portapapeles", "success");
      setTimeout(() => {
        copyBtn.innerHTML = `${COPY_ICON}Copiar texto`;
        copyBtn.classList.replace("green", "light");
      }, 2000);
    } catch {
      toast("No se pudo copiar el texto", "error");
    }
  });
}
