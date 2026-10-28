/**
 * Kinésica Admin - Persistencia y Sincronización de Textos de Clara
 * Envío diferencial al endpoint settings.php con control de concurrencia optimista (revision).
 */

import { api } from "./api.js?v=77";
import { validateCustomOptions } from "./config-options.js";

export async function saveTextsAndPolicies({
  triggerBtn,
  btnSaveTexts,
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
  loadConfigData,
}) {
  if (!textsLoaded || !loadedFormValues) {
    dialogAlert("Todavía se están cargando los textos guardados. Esperá unos segundos e intentá de nuevo.");
    if (typeof loadConfigData === "function") loadConfigData();
    return;
  }
  const isMailsBtn = triggerBtn === btnSaveMailsPolicies;
  if (btnSaveTexts) {
    btnSaveTexts.disabled = true;
    if (!isMailsBtn) btnSaveTexts.textContent = "Guardando...";
  }
  if (btnSaveMailsPolicies) {
    btnSaveMailsPolicies.disabled = true;
    if (isMailsBtn) btnSaveMailsPolicies.textContent = "Guardando...";
  }

  const restoreButtons = () => {
    if (btnSaveTexts) {
      btnSaveTexts.disabled = false;
      btnSaveTexts.textContent = "Guardar textos y políticas";
    }
    if (btnSaveMailsPolicies) {
      btnSaveMailsPolicies.disabled = false;
      btnSaveMailsPolicies.textContent = "Guardar políticas en mails";
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
    restoreButtons();
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
    if (typeof resetChatDemo === "function") resetChatDemo();
  } catch (err) {
    if (err?.status === 409) {
      dialogAlert(err.message || "Los textos se modificaron desde otra sesión. Recargá la página antes de guardar.");
    } else {
      dialogAlert(err?.message || "Error al guardar los textos de Clara.");
    }
  } finally {
    restoreButtons();
  }
}
