/**
 * Modal contacto / dispatch — Recordatorios.
 */

import { api } from "./api.js?v=79";
import { escapeHtml, toast } from "./dom.js?v=79";
import { normalizePhoneForWhatsApp } from "./phone-format.js?v=6";
import { markTestFieldError, clearTestFieldError } from "./recordatorios-modal-fields.js?v=1";
import { resolveRecordatorioEmail } from "./recordatorios-modal-email.js?v=1";
import { createRecordatorioContactApiHandlers } from "./recordatorios-modal-contact-api.js?v=1";

export function openRecordatorioContactModal(item, { mode = "contact", onSuccess } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "recordatorio-modal-backdrop";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");

  const resolvedEmail = resolveRecordatorioEmail(item);
  const name = escapeHtml(item.patient_name || item.event_summary || "Paciente");
  const appt = escapeHtml(
    [item.appointment_date, item.appointment_time].filter(Boolean).join(" · ") || "Sin fecha/hora"
  );
  const isDispatch = mode === "dispatch";
  const isFailed = item.status === "failed" || item.status === "missing_phone";
  const title = isDispatch
    ? isFailed
      ? "Disparar recordatorio manualmente"
      : "Enviar recordatorio ahora"
    : "Cargar teléfono / email";
  const currentError =
    item.error_message && !String(item.error_message).startsWith("contact_email:")
      ? item.error_message || item.error_code || ""
      : item.error_code || "";
  const missingHint = !item.wa_id
    ? `<p class="recordatorio-modal-hint">Este paciente no tiene WhatsApp en el turno ni en el directorio. Cargalo acá para la ejecución automática y futuros recordatorios.</p>`
    : "";

  backdrop.innerHTML = `
    <div class="recordatorio-modal-card">
      <div class="recordatorio-modal-header">
        <h3>${isDispatch ? "⚡" : "＋"} ${title}</h3>
        <button type="button" class="btn ghost btn-close-modal" aria-label="Cerrar">✕</button>
      </div>
      <div class="recordatorio-modal-body">
        <div class="recordatorio-modal-info">
          <div><strong>Paciente:</strong> ${name}</div>
          <div><strong>Turno:</strong> ${appt}</div>
          ${
            item.event_summary && item.event_summary !== item.patient_name
              ? `<div><strong>Detalle:</strong> ${escapeHtml(item.event_summary)}</div>`
              : ""
          }
          ${
            isFailed && currentError
              ? `<div style="color:#b42318;margin-top:6px;font-size:12px;"><strong>Motivo de fallo previo:</strong> ${escapeHtml(currentError)}</div>`
              : ""
          }
        </div>
        ${missingHint}
        <div class="recordatorio-modal-field">
          <label for="dispatch-phone">WhatsApp (con código de país, ej: 54911…):</label>
          <input type="tel" id="dispatch-phone" value="${escapeHtml(item.wa_id || "")}" placeholder="5491144556677" autocomplete="off" />
        </div>
        <div class="recordatorio-modal-field">
          <label for="dispatch-email">Correo electrónico:</label>
          <input type="email" id="dispatch-email" value="${escapeHtml(resolvedEmail)}" placeholder="paciente@ejemplo.com" autocomplete="off" />
        </div>
        ${
          isDispatch
            ? `<div class="recordatorio-modal-field">
          <label for="dispatch-channel">Canal de envío:</label>
          <select id="dispatch-channel">
            <option value="whatsapp" ${String(item.calendar_event_id || "").startsWith("test:") ? "selected" : ""}>Solo WhatsApp (Plantilla oficial)</option>
            <option value="auto" ${String(item.calendar_event_id || "").startsWith("test:") ? "" : "selected"}>Automático (WhatsApp con fallback a Email)</option>
            <option value="email">Solo Correo Electrónico</option>
          </select>
        </div>
        <label class="recordatorio-modal-check">
          <input type="checkbox" id="dispatch-save-contact" ${String(item.calendar_event_id || "").startsWith("test:") ? "" : "checked"} />
          Guardar también en el directorio de pacientes
        </label>`
            : `<p class="recordatorio-modal-hint">Se guarda en el directorio de pacientes y en este recordatorio. No envía el mensaje todavía.</p>`
        }
      </div>
      <div class="recordatorio-modal-actions">
        <button type="button" class="btn light btn-close-modal">Cancelar</button>
        ${
          isDispatch
            ? `<button type="button" class="btn green" id="btn-submit-dispatch">⚡ Enviar recordatorio</button>`
            : `<button type="button" class="btn green" id="btn-submit-contact">Guardar contacto</button>
               ${
                 item.status === "pending" ||
                 item.status === "failed" ||
                 item.status === "missing_phone" ||
                 item.status === "skipped"
                   ? `<button type="button" class="btn light" id="btn-submit-contact-send">Guardar y enviar</button>`
                   : ""
               }`
        }
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  const phoneInput = backdrop.querySelector("#dispatch-phone");
  const emailInput = backdrop.querySelector("#dispatch-email");

  const rawName = String(item.patient_name || item.event_summary || "").trim();
  const cleanLookupName = rawName.replace(/^(?:dr[a]?\.|lic\.|prof\.)\s*/i, "").trim();
  if (!item.wa_id && cleanLookupName && phoneInput) {
    api(`/api/pacientes.php?q=${encodeURIComponent(cleanLookupName)}`)
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        const match = items.find((p) => {
          const t = String(p.telefono || "").replace(/\D/g, "");
          return t.length >= 6;
        });
        if (match && phoneInput && !phoneInput.value.trim()) {
          const rawMatchPhone = String(match.telefono || "").trim();
          phoneInput.value = rawMatchPhone;
          const hintBox = document.createElement("div");
          hintBox.style.cssText = "font-size:12px;color:#0f766e;margin-top:5px;padding:4px 8px;background:#f0fdfa;border-radius:4px;border:1px solid #ccfbf1;";
          hintBox.innerHTML = `💡 Teléfono sugerido del registro: <strong>${escapeHtml(match.nombre_completo || cleanLookupName)}</strong> (${escapeHtml(rawMatchPhone)})`;
          phoneInput.parentElement.appendChild(hintBox);
          if (match.email && emailInput && !emailInput.value.trim()) {
            emailInput.value = String(match.email).trim();
          }
        }
      })
      .catch(() => {});
  }

  if (!item.wa_id) phoneInput?.focus();
  else emailInput?.focus();

  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
  };
  const onKeyDown = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKeyDown);
  backdrop.querySelectorAll(".btn-close-modal").forEach((btn) => {
    btn.addEventListener("click", close);
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  const readFields = () => {
    const rawPhone = backdrop.querySelector("#dispatch-phone")?.value.trim() || "";
    const normalized = normalizePhoneForWhatsApp(rawPhone);
    // Aceptar locales AR (ej. 1158236122 → 5491158236122); si no normaliza, mandar dígitos crudos.
    const phone = normalized || rawPhone.replace(/\D/g, "");
    if (normalized && phoneInput && phoneInput.value.trim() !== normalized) {
      phoneInput.value = normalized;
    }
    return {
      phone,
      email: backdrop.querySelector("#dispatch-email")?.value.trim() || "",
      channel: backdrop.querySelector("#dispatch-channel")?.value || "auto",
      saveContact: backdrop.querySelector("#dispatch-save-contact")
        ? !!backdrop.querySelector("#dispatch-save-contact")?.checked
        : true,
    };
  };

  const clearDispatchFieldErrors = () => {
    clearTestFieldError(backdrop.querySelector("#dispatch-phone"));
    clearTestFieldError(backdrop.querySelector("#dispatch-email"));
  };

  backdrop.querySelector("#dispatch-phone")?.addEventListener("input", () => {
    clearTestFieldError(backdrop.querySelector("#dispatch-phone"));
  });
  backdrop.querySelector("#dispatch-email")?.addEventListener("input", () => {
    clearTestFieldError(backdrop.querySelector("#dispatch-email"));
  });

  const { saveContactOnly, dispatchSend } = createRecordatorioContactApiHandlers(backdrop, item, { onSuccess, readFields, close });
  backdrop.querySelector("#btn-submit-contact")?.addEventListener("click", async (e) => {
    const resp = await saveContactOnly(e.currentTarget);
    if (resp) {
      close();
      toast(resp.message || "Contacto guardado.", { type: "success" });
    }
  });

  backdrop.querySelector("#btn-submit-contact-send")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const fields = readFields();
    const saved = await saveContactOnly(btn);
    if (!saved) return;
    await dispatchSend(btn, { ...fields, saveContact: false, channel: fields.phone ? "auto" : "email" });
  });

  backdrop.querySelector("#btn-submit-dispatch")?.addEventListener("click", async (e) => {
    await dispatchSend(e.currentTarget, readFields());
  });
}

export function openRecordatorioDispatchModal(item, onSuccess) {
  openRecordatorioContactModal(item, { mode: "dispatch", onSuccess });
}
