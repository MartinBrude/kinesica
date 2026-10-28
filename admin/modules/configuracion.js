/**
 * Kinésica Admin - Módulo de Configuración Unificada
 * Integra en un único centro de control:
 * 1. Mensajes de Clara en WhatsApp (Menú A-E y opciones)
 * 2. Mails y Políticas (Políticas de cancelación 24hs y notas)
 * 3. Horarios de Atención por profesional
 * 4. Honorarios y Medios de Pago
 */

import { renderOptCText, REMINDER_TEMPLATE_TEXT } from "./menu-texts.js?v=2";
import { api } from "./api.js?v=77";
import { dialogAlert } from "./dom.js?v=78";
import { appendChatMessage, resetChatDemo, initChatSimulator, setChatContext } from "./chat-simulator.js?v=9";
import { DEFAULT_CLARA_TEXTS, bindConfigInputs, populateClaraInputs } from "./config-defaults.js";
import { getNextAvailableLetter, renderCustomOptionsList } from "./config-options.js";
import {
  updateReminderPreview,
  updateStatusToggles,
  setupConfigToggles,
  bindPolicyElements,
  bindToggleElements,
} from "./config-toggles.js";
import { saveTextsAndPolicies } from "./config-save.js";
import {
  showConsultorioView,
  hideConsultorioView,
  showClaraView as showClaraSubView,
  hideClaraView,
  showConfiguracionView,
  hideConfiguracionView,
  switchConfigSubtab as switchConfigSubView,
} from "./config-views.js";

export { DEFAULT_CLARA_TEXTS };
export { showConsultorioView, hideConsultorioView, hideClaraView, showConfiguracionView, hideConfiguracionView };
export { appendChatMessage, resetChatDemo, initChatSimulator } from "./chat-simulator.js?v=9";

export function showClaraView() {
  showClaraSubView(() => {
    loadConfigData();
    const chatMessagesEl = document.querySelector("#chat-demo-messages");
    if (chatMessagesEl && chatMessagesEl.children.length === 0) resetChatDemo();
  });
}

export function switchConfigSubtab(subtabId) {
  switchConfigSubView(subtabId, () => showClaraView());
}

const configTabBtns = document.querySelectorAll(".config-tab-btn");
const claraInputs = bindConfigInputs();
const inputOptC = document.querySelector("#cfg-opt-c");
const pol = bindPolicyElements();
const tog = bindToggleElements();

const customOptionsContainer = document.querySelector("#custom-options-container");
const customOptionsEmpty = document.querySelector("#custom-options-empty");
const btnAddCustomOption = document.querySelector("#btn-add-custom-option");
let customMenuOptions = [];

const btnSaveTexts = document.querySelector("#btn-save-clara-texts");
const btnSaveMailsPolicies = document.querySelector("#btn-save-mails-policies");
const textsStatusBanner = document.querySelector("#clara-texts-status-banner");
const mailsStatusBanner = document.querySelector("#mails-texts-status-banner");

let currentTexts = { ...DEFAULT_CLARA_TEXTS };

setChatContext({
  defaults: DEFAULT_CLARA_TEXTS,
  inputs: claraInputs,
  getTexts: () => currentTexts,
  getCustomOptions: () => customMenuOptions,
});

let textsLoaded = false;
let textsRevision = null;
let loadedFormValues = null;
let activeClara = false;
let activeBooking = false;

function refreshReminderPreview() {
  updateReminderPreview({
    inputNotes: pol.reminderNotes,
    inputClaraNotes: pol.claraReminderNotes,
    previewEl: pol.reminderPreview,
    claraPreviewEl: pol.claraReminderPreview,
    defaultNotes: DEFAULT_CLARA_TEXTS.reminder_notes,
  });
}

function syncTogglesUI(isClaraOn, isBookingOn) {
  activeClara = isClaraOn;
  activeBooking = isBookingOn;
  updateStatusToggles({ ...tog, isClaraOn, isBookingOn });
}

function renderTexts(data) {
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
    customMenuOptions = JSON.parse(JSON.stringify(t.custom_menu_options));
  } else if (Array.isArray(t.clara_texts?.custom_menu_options)) {
    customMenuOptions = JSON.parse(JSON.stringify(t.clara_texts.custom_menu_options));
  } else {
    customMenuOptions = [];
  }
  renderCustomOptionsList(customOptionsContainer, customOptionsEmpty, customMenuOptions, dialogAlert);
  resetChatDemo();
}

function readFormTexts() {
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
  textsRevision = Number(data?.clara_texts_revision ?? 0) || 0;
  loadedFormValues = { texts: readFormTexts(), custom: JSON.stringify(customMenuOptions) };
  textsLoaded = true;
}

function applyConfigResult(res) {
  if (!res) return;
  if (res.clara_texts) currentTexts = { ...DEFAULT_CLARA_TEXTS, ...res.clara_texts };
  if (res.custom_menu_options) currentTexts.custom_menu_options = res.custom_menu_options;
  renderTexts(currentTexts);
  rememberLoadedTexts(res);
}

async function loadConfigData() {
  try {
    const data = await api("settings.php?_t=" + Date.now());
    if (data) {
      applyConfigResult(data);
      syncTogglesUI(data.clara_active ?? true, data.booking_active ?? true);
    }
  } catch (err) {
    console.warn("No se pudo cargar la configuración:", err);
  }
}

export function initConfiguracionModule(callbacks = {}) {
  configTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchConfigSubtab(btn.dataset.subtab));
  });

  btnAddCustomOption?.addEventListener("click", () => {
    const nextL = getNextAvailableLetter(customMenuOptions);
    customMenuOptions.push({ letter: nextL, label: "", response: "" });
    renderCustomOptionsList(customOptionsContainer, customOptionsEmpty, customMenuOptions, dialogAlert);
  });

  const onSave = (btn) => saveTextsAndPolicies({
    triggerBtn: btn,
    btnSaveTexts,
    btnSaveMailsPolicies,
    textsStatusBanner,
    mailsStatusBanner,
    textsLoaded,
    loadedFormValues,
    textsRevision,
    customMenuOptions,
    readFormTexts,
    onSaveSuccess: applyConfigResult,
    resetChatDemo,
    dialogAlert,
    loadConfigData,
  });

  btnSaveTexts?.addEventListener("click", () => onSave(btnSaveTexts));
  btnSaveMailsPolicies?.addEventListener("click", () => onSave(btnSaveMailsPolicies));

  const syncAndPreview = (source, target) => {
    if (target && source) target.value = source.value;
    refreshReminderPreview();
  };
  pol.reminderNotes?.addEventListener("input", () => syncAndPreview(pol.reminderNotes, pol.claraReminderNotes));
  pol.claraReminderNotes?.addEventListener("input", () => syncAndPreview(pol.claraReminderNotes, pol.reminderNotes));

  setupConfigToggles({
    cfgClaraToggleBtn: tog.cfgClaraToggleBtn,
    cfgBookingToggleBtn: tog.cfgBookingToggleBtn,
    getClaraActive: () => activeClara,
    getBookingActive: () => activeBooking,
    onClaraChanged: (next) => {
      activeClara = next;
      syncTogglesUI(next, activeBooking);
      callbacks.onClaraToggled?.(next);
    },
    onBookingChanged: (next) => {
      activeBooking = next;
      syncTogglesUI(activeClara, next);
      callbacks.onBookingToggled?.(next);
    },
    onAlert: dialogAlert,
  });

  initChatSimulator();

  let welcomeTimer = null;
  claraInputs.menuWelcome?.addEventListener("input", () => {
    clearTimeout(welcomeTimer);
    welcomeTimer = setTimeout(() => resetChatDemo(), 400);
  });
}

export function previewOptCText(optC, fees) {
  return renderOptCText(optC, fees);
}
