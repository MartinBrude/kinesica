/**
 * Modal contacto / dispatch — Recordatorios.
 */

import { api } from "./api.js?v=79";
import { escapeHtml, toast } from "./dom.js?v=79";
import { normalizePhoneForWhatsApp } from "./phone-format.js?v=6";
import { markTestFieldError, clearTestFieldError } from "./recordatorios-modal-fields.js?v=1";
import { resolveRecordatorioEmail } from "./recordatorios-modal-email.js?v=1";
import { createRecordatorioContactApiHandlers } from "./recordatorios-modal-contact-api.js?v=1";

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePersonName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dniLooksSame(a, b) {
  const x = digitsOnly(a);
  const y = digitsOnly(b);
  if (x.length < 6 || y.length < 6) return false;
  return x === y || x.endsWith(y) || y.endsWith(x);
}

function applySuggestedContact(match, phoneInput, emailInput) {
  if (!match || !phoneInput || phoneInput.value.trim()) return;
  const rawMatchPhone = String(match.telefono || "").trim();
  if (!rawMatchPhone) return;
  phoneInput.value = rawMatchPhone;
  if (match.email && emailInput && !emailInput.value.trim()) {
    emailInput.value = String(match.email).trim();
  }
}

/**
 * Autocomplete de teléfono desde directorio:
 * - 1 coincidencia clara → rellena
 * - si hay DNI en el turno, desambigua con documento
 * - si hay colisión → no rellena; pide revisión con opciones
 */
function suggestPhoneFromDirectory({ lookupName, eventDni, phoneInput, emailInput }) {
  const q = normalizePersonName(lookupName);
  const eventDniDigits = digitsOnly(eventDni);
  api(`pacientes.php?q=${encodeURIComponent(lookupName)}`)
    .then((res) => {
      if (!phoneInput || phoneInput.value.trim()) return;
      const items = Array.isArray(res?.items) ? res.items : [];
      const withPhone = items.filter((p) => digitsOnly(p.telefono).length >= 6);
      const nameMatches = withPhone.filter((p) => {
        const full = normalizePersonName(p.nombre_completo || p.nombre || "");
        return full !== "" && (full === q || full.includes(q) || q.includes(full));
      });
      if (nameMatches.length === 0) return;

      let pool = nameMatches.filter(
        (p) => normalizePersonName(p.nombre_completo || p.nombre || "") === q
      );
      if (pool.length === 0) pool = nameMatches;

      if (eventDniDigits.length >= 6) {
        const byDni = pool.filter((p) => dniLooksSame(p.dni, eventDniDigits));
        if (byDni.length === 1) {
          applySuggestedContact(byDni[0], phoneInput, emailInput);
          renderPhoneSuggestHint(phoneInput, {
            kind: "ok",
            match: byDni[0],
            note: "coincidió nombre + documento",
          });
          return;
        }
        if (byDni.length > 1) {
          renderPhoneSuggestHint(phoneInput, {
            kind: "collision",
            candidates: byDni,
            emailInput,
          });
          return;
        }
        // Hay DNI en el turno pero ninguno del directorio lo matchea: pedir revisión.
        if (pool.length >= 1) {
          renderPhoneSuggestHint(phoneInput, {
            kind: "collision",
            candidates: pool.slice(0, 5),
            emailInput,
            note: "El documento del turno no coincidió con el directorio. Revisá antes de enviar.",
          });
          return;
        }
      }

      if (pool.length === 1) {
        applySuggestedContact(pool[0], phoneInput, emailInput);
        renderPhoneSuggestHint(phoneInput, { kind: "ok", match: pool[0] });
        return;
      }

      renderPhoneSuggestHint(phoneInput, {
        kind: "collision",
        candidates: pool.slice(0, 5),
        emailInput,
      });
    })
    .catch(() => {});
}

function renderPhoneSuggestHint(phoneInput, opts) {
  const parent = phoneInput?.parentElement;
  if (!parent) return;
  parent.querySelectorAll(".recordatorio-phone-suggest").forEach((el) => el.remove());

  const hintBox = document.createElement("div");
  if (opts.kind === "ok") {
    const match = opts.match;
    const rawMatchPhone = String(match.telefono || "").trim();
    hintBox.className = "recordatorio-phone-suggest";
    hintBox.innerHTML = `Teléfono sugerido: <strong>${escapeHtml(
      match.nombre_completo || "Paciente"
    )}</strong> (${escapeHtml(rawMatchPhone)})${
      opts.note ? ` · ${escapeHtml(opts.note)}` : ""
    }`;
    parent.appendChild(hintBox);
    return;
  }

  const candidates = Array.isArray(opts.candidates) ? opts.candidates : [];
  hintBox.className = "recordatorio-phone-suggest recordatorio-phone-suggest--warn";
  const note =
    opts.note ||
    `Hay ${candidates.length} coincidencias en el directorio. Elegí la correcta antes de enviar.`;
  const rows = candidates
    .map((c, idx) => {
      const name = escapeHtml(c.nombre_completo || c.nombre || "Paciente");
      const phone = escapeHtml(String(c.telefono || "").trim());
      const dni = digitsOnly(c.dni);
      const dniLabel = dni ? ` · DNI ${escapeHtml(dni)}` : "";
      return `<button type="button" class="recordatorio-phone-pick" data-pick-idx="${idx}">Usar: ${name} (${phone})${dniLabel}</button>`;
    })
    .join("");
  hintBox.innerHTML = `<div>${escapeHtml(note)}</div>${rows}`;
  parent.appendChild(hintBox);

  hintBox.querySelectorAll(".recordatorio-phone-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-pick-idx"));
      const chosen = candidates[idx];
      if (!chosen) return;
      phoneInput.value = "";
      applySuggestedContact(chosen, phoneInput, opts.emailInput);
      renderPhoneSuggestHint(phoneInput, {
        kind: "ok",
        match: chosen,
        note: "elegido manualmente",
      });
    });
  });
}

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
    suggestPhoneFromDirectory({
      lookupName: cleanLookupName,
      eventDni: String(item.dni || ""),
      phoneInput,
      emailInput,
    });
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
