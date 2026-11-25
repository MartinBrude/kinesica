/**
 * Handlers API para modal contacto recordatorio.
 */

import { api } from "./api.js?v=79";
import { toast, dialogAlert } from "./dom.js?v=79";
import { markTestFieldError, clearTestFieldError } from "./recordatorios-modal-fields.js?v=1";
import { loadRecordatorios } from "./recordatorios-load.js?v=2";

export function createRecordatorioContactApiHandlers(backdrop, item, { onSuccess, readFields, close }) {
  const clearDispatchFieldErrors = () => {
    clearTestFieldError(backdrop.querySelector("#dispatch-phone"));
    clearTestFieldError(backdrop.querySelector("#dispatch-email"));
  };

    const saveContactOnly = async (btn) => {
    clearDispatchFieldErrors();
    const { phone, email } = readFields();
    if (!phone && !email) {
      markTestFieldError(
        backdrop.querySelector("#dispatch-phone"),
        "Ingresá al menos un WhatsApp o un correo electrónico."
      );
      return false;
    }
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Guardando…";
    try {
      const resp = await api("recordatorios.php", {
        method: "POST",
        body: JSON.stringify({
          action: "save_contact",
          id: item.id,
          wa_id: phone,
          email,
        }),
      });
      if (resp && (resp.ok || resp.status === "success")) {
        if (resp.item) onSuccess?.(resp.item);
        else loadRecordatorios(false);
        return resp;
      }
      const payload = resp || {};
      dialogAlert(payload.error || "No se pudo guardar el contacto.", {
        type: "danger",
        category: payload.error_category || "user_input",
        hint: payload.hint,
        errorId: payload.error_id,
        errorCode: payload.error_code,
      });
      return false;
    } catch (err) {
      const payload = (err && err.payload) || {};
      dialogAlert(
        payload.error || err.message || "Error al guardar el contacto.",
        {
          type: "danger",
          category: payload.error_category || err.category || "user_input",
          hint: payload.hint || err.hint,
          errorId: payload.error_id || err.errorId,
          errorCode: payload.error_code || err.code,
        }
      );
      return false;
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  };

  const dispatchSend = async (btn, { phone, email, channel, saveContact }) => {
    clearDispatchFieldErrors();
    if (channel === "email" && !email) {
      markTestFieldError(backdrop.querySelector("#dispatch-email"), "Ingresá un correo válido para enviar por email.");
      return;
    }
    if (channel === "whatsapp" && !phone) {
      markTestFieldError(backdrop.querySelector("#dispatch-phone"), "Ingresá un número de WhatsApp.");
      return;
    }
    if (channel === "auto" && !phone && !email) {
      markTestFieldError(
        backdrop.querySelector("#dispatch-phone"),
        "Ingresá al menos un WhatsApp o un correo."
      );
      return;
    }
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Enviando…";
    try {
      const resp = await api("recordatorios.php", {
        method: "POST",
        body: JSON.stringify({
          action: "dispatch",
          id: item.id,
          wa_id: phone,
          email,
          channel,
          save_contact: saveContact,
        }),
      });
      if (resp && (resp.ok || resp.status === "success")) {
        close();
        if (resp.item) onSuccess?.(resp.item);
        else loadRecordatorios(false);
        toast(resp.message || "Recordatorio enviado correctamente.", { type: "success" });
      } else {
        const payload = resp || {};
        dialogAlert(payload.error || "No se pudo enviar el recordatorio.", {
          type: "danger",
          category: payload.error_category || "user_input",
          hint: payload.hint,
          errorId: payload.error_id,
          errorCode: payload.error_code,
        });
      }
    } catch (err) {
      const payload = (err && err.payload) || {};
      dialogAlert(
        payload.error ||
          err.message ||
          "Error al conectar con el servidor para disparar el recordatorio.",
        {
          type: "danger",
          category:
            payload.error_category ||
            err.category ||
            (err.network ? "infrastructure" : "software_logic"),
          hint: payload.hint || err.hint,
          errorId: payload.error_id || err.errorId,
          errorCode: payload.error_code || err.code,
        }
      );
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  };

  return { saveContactOnly, dispatchSend };
}
