/**
 * Modal caso de prueba.
 */

import { api } from "./api.js?v=79";
import { escapeHtml, toast, dialogAlert } from "./dom.js?v=79";
import { normalizePhoneForWhatsApp } from "./phone-format.js?v=6";
import { markTestFieldError, clearTestFieldError } from "./recordatorios-modal-fields.js?v=1";
import { resolveRecordatorioEmail, storeTestContact, defaultTestContact } from "./recordatorios-modal-email.js?v=1";
import { loadRecordatorios } from "./recordatorios-load.js?v=1";
import { applyRecordatorioItemUpdate } from "./recordatorios-apply.js?v=1";

export function openTestCaseModal() {
  document.querySelectorAll(".recordatorio-modal-backdrop[data-test-case-modal]").forEach((el) => el.remove());

  const defaults = defaultTestContact();
  const backdrop = document.createElement("div");
  backdrop.className = "recordatorio-modal-backdrop";
  backdrop.dataset.testCaseModal = "1";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-labelledby", "test-case-modal-title");
  // Estilos inline: el modal tiene que verse aunque el CSS del admin esté cacheado.
  backdrop.style.cssText =
    "position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;" +
    "padding:16px;background:rgba(11,37,69,.55);";
  backdrop.innerHTML = `
    <div class="recordatorio-modal-card" style="background:#fff;border:1px solid #d7dee7;border-radius:12px;max-width:500px;width:100%;box-shadow:0 16px 36px rgba(11,37,69,.2);padding:24px;display:flex;flex-direction:column;gap:16px;">
      <div class="recordatorio-modal-header" style="display:flex;justify-content:space-between;align-items:center;">
        <h3 id="test-case-modal-title" style="margin:0;font-size:17px;">＋ Caso de prueba</h3>
        <button type="button" class="btn ghost btn-close-modal" aria-label="Cerrar">✕</button>
      </div>
      <div class="recordatorio-modal-body" style="display:flex;flex-direction:column;gap:12px;font-size:13px;">
        <p class="recordatorio-modal-hint" style="margin:0;font-size:12px;line-height:1.45;color:#5b6b7c;">Completá nombre y WhatsApp para crear un pending de prueba. No se guarda en el directorio de pacientes.</p>
        <div class="recordatorio-modal-field" style="display:flex;flex-direction:column;gap:4px;">
          <label for="test-case-name" style="font-weight:600;font-size:12px;">Nombre</label>
          <input type="text" id="test-case-name" value="${escapeHtml(defaults.name)}" placeholder="Nombre del destinatario" autocomplete="name" required style="padding:9px 12px;border:1px solid #d7dee7;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>
        <div class="recordatorio-modal-field" style="display:flex;flex-direction:column;gap:4px;">
          <label for="test-case-phone" style="font-weight:600;font-size:12px;">WhatsApp (con código de país)</label>
          <input type="tel" id="test-case-phone" value="${escapeHtml(defaults.phone)}" placeholder="54911… o 346…" autocomplete="tel" required style="padding:9px 12px;border:1px solid #d7dee7;border-radius:8px;font-size:13px;font-family:inherit;" />
        </div>
      </div>
      <div class="recordatorio-modal-actions" style="display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;margin-top:8px;">
        <button type="button" class="btn light btn-close-modal">Cancelar</button>
        <button type="button" class="btn green" id="btn-submit-test-case">Crear caso</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  const nameInput = backdrop.querySelector("#test-case-name");
  const phoneInput = backdrop.querySelector("#test-case-phone");
  (defaults.name ? phoneInput : nameInput)?.focus();
  nameInput?.addEventListener("input", () => clearTestFieldError(nameInput));
  phoneInput?.addEventListener("input", () => clearTestFieldError(phoneInput));

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

  backdrop.querySelector("#btn-submit-test-case")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const name = nameInput?.value.trim() || "";
    const rawPhone = phoneInput?.value.trim() || "";
    const normalized = normalizePhoneForWhatsApp(rawPhone);
    const phone = normalized || rawPhone.replace(/\D/g, "");
    if (normalized && phoneInput && phoneInput.value.trim() !== normalized) {
      phoneInput.value = normalized;
    }
    clearTestFieldError(nameInput);
    clearTestFieldError(phoneInput);
    if (!name) {
      markTestFieldError(nameInput, "Ingresá el nombre del destinatario.");
      return;
    }
    if (!phone || phone.length < 8) {
      markTestFieldError(phoneInput, "Ingresá un WhatsApp válido (con código de país).");
      return;
    }

    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Creando…";
    try {
      const resp = await api("recordatorios.php", {
        method: "POST",
        body: JSON.stringify({
          action: "create_test_case",
          patient_name: name,
          phone,
        }),
      });
      if (resp && (resp.ok || resp.status === "success")) {
        const knownEmail =
          String(resp.item?.email || "").trim() ||
          resolveRecordatorioEmail({ wa_id: phone, patient_name: name, email: "" });
        storeTestContact(name, phone, knownEmail);
        close();
        if (resp.item) {
          applyRecordatorioItemUpdate({
            ...resp.item,
            email: String(resp.item.email || "").trim() || knownEmail,
          });
        } else await loadRecordatorios(false);
        toast(resp.message || "Caso de prueba listo. Usá «Enviar ahora».", { type: "success" });
        return;
      }
      dialogAlert(resp?.error || "No se pudo crear el caso de prueba.", { type: "danger" });
    } catch (err) {
      dialogAlert(
        (err && (err.payload?.error || err.message)) || "Error al crear el caso de prueba.",
        { type: "danger" }
      );
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });
}
