import { dialogAlert, toast } from "./dom.js?v=79";
import { resetChatDemo, initChatSimulator } from "./chat-simulator.js?v=18";
import { initMailPreview, refreshMailPreviewPrefill } from "./mail-preview.js?v=2";
import { saveTextsAndPolicies } from "./config-save.js";
import { setupConfigToggles } from "./config-toggles.js";
import {
  configTabBtns,
  claraInputs,
  pol,
  tog,
  btnAddCustomOption,
  btnSaveGlobal,
  btnSaveMailsPolicies,
  textsStatusBanner,
  mailsStatusBanner,
  getCustomMenuOptions,
  isTextsLoaded,
  getLoadedFormValues,
  getTextsRevision,
  isActiveClara,
  isActiveBooking,
  setActiveClara,
  setActiveBooking,
} from "./configuracion-state.js";
import {
  bindClaraDirtyListeners,
  clearClaraDirty,
  markClaraDirty,
  isColaboradorUser,
  addCustomMenuOption,
} from "./configuracion-clara-dirty.js";
import {
  readFormTexts,
  applyConfigResult,
  loadConfigData,
  refreshReminderPreview,
  syncTogglesUI,
} from "./configuracion-clara-data.js";
import { switchConfigSubtab } from "./configuracion-nav.js";

export function initConfiguracionModule(callbacks = {}) {
  configTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchConfigSubtab(btn.dataset.subtab));
  });

  bindClaraDirtyListeners();
  clearClaraDirty();

  btnAddCustomOption?.addEventListener("click", addCustomMenuOption);

  const onSave = (btn) => {
    if (isColaboradorUser()) return;
    return saveTextsAndPolicies({
      triggerBtn: btn,
      btnSaveMailsPolicies,
      textsStatusBanner,
      mailsStatusBanner,
      textsLoaded: isTextsLoaded(),
      loadedFormValues: getLoadedFormValues(),
      textsRevision: getTextsRevision(),
      customMenuOptions: getCustomMenuOptions(),
      readFormTexts,
      onSaveSuccess: applyConfigResult,
      resetChatDemo,
      dialogAlert,
      toast,
      onDirtyCleared: clearClaraDirty,
      loadConfigData,
    });
  };

  btnSaveMailsPolicies?.addEventListener("click", () => onSave(btnSaveMailsPolicies));
  btnSaveGlobal?.addEventListener("click", () => onSave(btnSaveGlobal));

  const syncAndPreview = (source, target) => {
    if (target && source) target.value = source.value;
    refreshReminderPreview();
    markClaraDirty();
  };
  pol.reminderNotes?.addEventListener("input", () => syncAndPreview(pol.reminderNotes, pol.claraReminderNotes));
  pol.claraReminderNotes?.addEventListener("input", () => syncAndPreview(pol.claraReminderNotes, pol.reminderNotes));

  setupConfigToggles({
    cfgClaraToggleBtn: tog.cfgClaraToggleBtn,
    cfgBookingToggleBtn: tog.cfgBookingToggleBtn,
    getClaraActive: () => isActiveClara(),
    getBookingActive: () => isActiveBooking(),
    onClaraChanged: (next) => {
      setActiveClara(next);
      syncTogglesUI(next, isActiveBooking());
      callbacks.onClaraToggled?.(next);
      toast(next ? "Clara visible en web + recordatorios." : "Clara oculta en web (sin recordatorios).", { type: "success" });
    },
    onBookingChanged: (next) => {
      setActiveBooking(next);
      syncTogglesUI(isActiveClara(), next);
      callbacks.onBookingToggled?.(next);
      toast(next ? "Turnera web activada." : "Turnera web pausada.", { type: "success" });
    },
    onAlert: dialogAlert,
  });

  initChatSimulator();
  initMailPreview();

  let welcomeTimer = null;
  claraInputs.menuWelcome?.addEventListener("input", () => {
    clearTimeout(welcomeTimer);
    welcomeTimer = setTimeout(() => resetChatDemo(), 400);
  });
}
