/**
 * Kinésica Admin - Persistencia y Sincronización de Textos de Clara
 * Envío diferencial al endpoint settings.php con control de concurrencia optimista (revision).
 */

import { api } from "./api.js?v=78";
import { validateCustomOptions } from "./config-options.js";

export async function saveTextsAndPolicies({
  triggerBtn,
  btnSaveMailsPolicies,
  textsStatusBanner,
  mailsStatusBanner,
  textsLoaded,
  loadedFormValues,
  textsRevision,
  customMenuOptions,
  readFormTexts,
  onSaveSuccess,
  resetChatDemo,
  dialogAlert,
  toast,
  onDirtyCleared,
  loadConfigData,
}) {
  const notify = typeof toast === "function" ? toast : dialogAlert;
  if (!textsLoaded || !loadedFormValues) {
    notify("Todavía se están cargando los textos guardados. Esperá unos segundos e intentá de nuevo.", { type: "info" });
    if (typeof loadConfigData === "function") loadConfigData();
    return;
  }
  const isMailsBtn = triggerBtn === btnSaveMailsPolicies;
  const allSaveButtons = [
    btnSaveMailsPolicies,
    triggerBtn,
    document.querySelector("#btn-save-clara-global"),
  ].filter(Boolean);

  const originalTexts = new Map();
  allSaveButtons.forEach((b) => {
    originalTexts.set(b, b.textContent);
    b.disabled = true;
    b.textContent = "Guardando...";
  });

  let restored = false;
  const restoreButtons = (feedbackText = "", { keepDisabled = false } = {}) => {
    if (restored) return;
    restored = true;
    if (feedbackText) {
      allSaveButtons.forEach((b) => {
        b.disabled = keepDisabled;
        b.textContent = feedbackText;
      });
      setTimeout(() => {
        allSaveButtons.forEach((b) => {
          b.textContent = originalTexts.get(b) || "Guardar cambios";
          if (!keepDisabled) b.disabled = false;
        });
      }, 2500);
    } else {
      allSaveButtons.forEach((b) => {
        b.disabled = keepDisabled;
        b.textContent = originalTexts.get(b) || "Guardar cambios";
      });
    }
  };

  const cleanCustom = validateCustomOptions(customMenuOptions, dialogAlert);
  if (!cleanCustom) {
    restoreButtons();
    return;
  }

  const formTexts = readFormTexts();
  const changedTexts = {};
  for (const [key, value] of Object.entries(formTexts)) {
    if (value !== loadedFormValues.texts[key]) changedTexts[key] = value;
  }
  const customChanged = JSON.stringify(cleanCustom) !== JSON.stringify(
    JSON.parse(loadedFormValues.custom || "[]").map((o) => ({ letter: o.letter, label: o.label, response: o.response }))
  );
  if (!Object.keys(changedTexts).length && !customChanged) {
    const banner = isMailsBtn ? mailsStatusBanner : textsStatusBanner;
    if (banner) {
      banner.textContent = "No hay cambios para guardar.";
      banner.className = "horarios-alert-box is-success";
      banner.hidden = false;
      setTimeout(() => { banner.hidden = true; }, 4000);
    }
    if (typeof toast === "function") toast("No hay cambios para guardar.", { type: "info" });
    if (typeof onDirtyCleared === "function") onDirtyCleared();
    restoreButtons("Sin cambios pendientes", { keepDisabled: true });
    return;
  }
  const payload = { base_revision: textsRevision, clara_texts: changedTexts };
  if (customChanged) {
    payload.clara_texts.custom_menu_options = cleanCustom;
    payload.custom_menu_options = cleanCustom;
  }

  try {
    const res = await api("settings.php", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (typeof onSaveSuccess === "function") {
      onSaveSuccess(res);
    }
    const showSuccess = (banner, msg) => {
      if (!banner) return;
      banner.textContent = msg;
      banner.className = "horarios-alert-box is-success";
      banner.hidden = false;
      setTimeout(() => { banner.hidden = true; }, 4000);
    };
    showSuccess(textsStatusBanner, "✓ Textos y opciones del menú guardados con éxito.");
    showSuccess(mailsStatusBanner, "✓ Políticas y pautas de mails guardadas con éxito.");
    if (typeof toast === "function") toast("Cambios de Clara guardados.", { type: "success" });
    if (typeof onDirtyCleared === "function") onDirtyCleared();
    if (typeof resetChatDemo === "function") resetChatDemo();
    restoreButtons("✓ Guardado", { keepDisabled: true });
  } catch (err) {
    restoreButtons();
    if (err?.status === 409) {
      dialogAlert(err.message || "Los textos se modificaron desde otra sesión. Recargá la página antes de guardar.", { type: "danger" });
    } else {
      dialogAlert(err?.message || "Error al guardar los textos de Clara.", { type: "danger" });
    }
  } finally {
    // restoreButtons is idempotent; only runs if not already restored.
    restoreButtons();
  }
}
