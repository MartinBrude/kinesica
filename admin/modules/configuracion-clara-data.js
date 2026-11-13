import { REMINDER_TEMPLATE_TEXT } from "./menu-texts.js?v=3";
import { api } from "./api.js?v=79";
import { DEFAULT_CLARA_TEXTS, populateClaraInputs } from "./config-defaults.js?v=5";
import { updateReminderPreview, updateStatusToggles } from "./config-toggles.js";
import { resetChatDemo } from "./chat-simulator.js?v=18";
import {
  claraInputs,
  inputOptC,
  pol,
  tog,
  setCustomMenuOptions,
  getCustomMenuOptions,
  setCurrentTexts,
  getCurrentTexts,
  setTextsRevision,
  setLoadedFormValues,
  setTextsLoaded,
  setActiveClara,
  setActiveBooking,
} from "./configuracion-state.js";
import {
  clearClaraDirty,
  refreshCustomOptionsList,
  markClaraDirty,
  applyColaboradorReadOnly,
} from "./configuracion-clara-dirty.js";

export function refreshReminderPreview() {
  updateReminderPreview({
    inputNotes: pol.reminderNotes,
    inputClaraNotes: pol.claraReminderNotes,
    previewEl: pol.reminderPreview,
    claraPreviewEl: pol.claraReminderPreview,
    defaultNotes: DEFAULT_CLARA_TEXTS.reminder_notes,
  });
}

export function syncTogglesUI(isClaraOn, isBookingOn) {
  setActiveClara(isClaraOn);
  setActiveBooking(isBookingOn);
  updateStatusToggles({ ...tog, isClaraOn, isBookingOn });
}

export function renderTexts(data) {
  const t = data || {};
  const def = DEFAULT_CLARA_TEXTS;
  populateClaraInputs(claraInputs, t, def);

  if (pol.cancellation) pol.cancellation.value = (typeof t.cancellation_policy === "string" && t.cancellation_policy.trim()) ? t.cancellation_policy : def.cancellation_policy;
  if (pol.confirmation) pol.confirmation.value = (typeof t.confirmation_notes === "string" && t.confirmation_notes.trim()) ? t.confirmation_notes : def.confirmation_notes;

  const rNotes = (typeof t.reminder_notes === "string" && t.reminder_notes.trim()) ? t.reminder_notes : def.reminder_notes;
  if (pol.reminderText) pol.reminderText.value = REMINDER_TEMPLATE_TEXT;
  if (pol.claraReminderText) pol.claraReminderText.value = REMINDER_TEMPLATE_TEXT;
  if (pol.reminderNotes) pol.reminderNotes.value = rNotes;
  if (pol.claraReminderNotes) pol.claraReminderNotes.value = rNotes;
  refreshReminderPreview();

  if (Array.isArray(t.custom_menu_options)) {
    setCustomMenuOptions(JSON.parse(JSON.stringify(t.custom_menu_options)));
  } else if (Array.isArray(t.clara_texts?.custom_menu_options)) {
    setCustomMenuOptions(JSON.parse(JSON.stringify(t.clara_texts.custom_menu_options)));
  } else {
    setCustomMenuOptions([]);
  }
  refreshCustomOptionsList(markClaraDirty);
  resetChatDemo();
}

export function readFormTexts() {
  const def = DEFAULT_CLARA_TEXTS;
  return {
    menu_welcome: claraInputs.menuWelcome?.value?.trim() || def.menu_welcome,
    opt_a_text: claraInputs.optA?.value?.trim() || def.opt_a_text,
    opt_b_text: claraInputs.optB?.value?.trim() || def.opt_b_text,
    opt_c_text: inputOptC?.value?.trim() || def.opt_c_text,
    opt_d_text: claraInputs.optD?.value?.trim() || def.opt_d_text,
    opt_e_text: claraInputs.optE?.value?.trim() || def.opt_e_text,
    submenu_turnos_text: claraInputs.submenuTurnos?.value?.trim() || def.submenu_turnos_text,
    opt_a2_text: claraInputs.optA2?.value?.trim() || def.opt_a2_text,
    opt_e1_text: claraInputs.optE1?.value?.trim() || def.opt_e1_text,
    opt_e2_text: claraInputs.optE2?.value?.trim() || def.opt_e2_text,
    opt_e3_text: claraInputs.optE3?.value?.trim() || def.opt_e3_text,
    menu_welcome_en: claraInputs.menuWelcomeEn?.value?.trim() || def.menu_welcome_en,
    opt_a_text_en: claraInputs.optAEn?.value?.trim() || def.opt_a_text_en,
    opt_b_text_en: claraInputs.optBEn?.value?.trim() || def.opt_b_text_en,
    opt_c_text_en: claraInputs.optCEn?.value?.trim() || def.opt_c_text_en,
    opt_d_text_en: claraInputs.optDEn?.value?.trim() || def.opt_d_text_en,
    opt_e_text_en: claraInputs.optEEn?.value?.trim() || def.opt_e_text_en,
    submenu_turnos_text_en: claraInputs.submenuTurnosEn?.value?.trim() || def.submenu_turnos_text_en,
    opt_a2_text_en: claraInputs.optA2En?.value?.trim() || def.opt_a2_text_en,
    opt_e1_text_en: claraInputs.optE1En?.value?.trim() || def.opt_e1_text_en,
    opt_e2_text_en: claraInputs.optE2En?.value?.trim() || def.opt_e2_text_en,
    opt_e3_text_en: claraInputs.optE3En?.value?.trim() || def.opt_e3_text_en,
    cancellation_policy: pol.cancellation?.value?.trim() || def.cancellation_policy,
    confirmation_notes: pol.confirmation?.value?.trim() || def.confirmation_notes,
    reminder_notes: pol.reminderNotes?.value?.trim() || pol.claraReminderNotes?.value?.trim() || def.reminder_notes,
  };
}

function rememberLoadedTexts(data) {
  setTextsRevision(Number(data?.clara_texts_revision ?? 0) || 0);
  setLoadedFormValues({ texts: readFormTexts(), custom: JSON.stringify(getCustomMenuOptions()) });
  setTextsLoaded(true);
  clearClaraDirty();
}

export function applyConfigResult(res) {
  if (!res) return;
  if (res.clara_texts) setCurrentTexts({ ...DEFAULT_CLARA_TEXTS, ...res.clara_texts });
  if (res.custom_menu_options) {
    const merged = { ...getCurrentTexts(), custom_menu_options: res.custom_menu_options };
    setCurrentTexts(merged);
  }
  renderTexts(getCurrentTexts());
  rememberLoadedTexts(res);
  applyColaboradorReadOnly();
}

export async function loadConfigData() {
  try {
    const data = await api("settings.php?_t=" + Date.now());
    if (data) {
      applyConfigResult(data);
      syncTogglesUI(data.clara_active ?? true, data.booking_active ?? true);
      applyColaboradorReadOnly();
    }
  } catch (err) {
    console.warn("No se pudo cargar la configuración:", err);
  }
}
