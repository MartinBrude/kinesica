import { DEFAULT_CLARA_TEXTS, bindConfigInputs } from "./config-defaults.js?v=5";
import { bindPolicyElements, bindToggleElements } from "./config-toggles.js";
import { setChatContext } from "./chat-simulator.js?v=18";

export const configTabBtns = document.querySelectorAll(".config-tab-btn");
export const claraInputs = bindConfigInputs();
export const inputOptC = document.querySelector("#cfg-opt-c");
export const pol = bindPolicyElements();
export const tog = bindToggleElements();

export const customOptionsContainer = document.querySelector("#custom-options-container");
export const customOptionsEmpty = document.querySelector("#custom-options-empty");
export const btnAddCustomOption = document.querySelector("#btn-add-custom-option");

export const btnSaveGlobal = document.querySelector("#btn-save-clara-global");
export const btnSaveMailsPolicies = document.querySelector("#btn-save-mails-policies");
export const textsStatusBanner = document.querySelector("#clara-texts-status-banner");
export const mailsStatusBanner = document.querySelector("#mails-texts-status-banner");
export const dirtyBadge = document.querySelector("#clara-dirty-badge");

let customMenuOptions = [];
let currentTexts = { ...DEFAULT_CLARA_TEXTS };
let claraDirty = false;
let textsLoaded = false;
let textsRevision = null;
let loadedFormValues = null;
let activeClara = false;
let activeBooking = false;

export function getCustomMenuOptions() { return customMenuOptions; }
export function setCustomMenuOptions(opts) {
  customMenuOptions = Array.isArray(opts) ? opts : [];
}

export function getCurrentTexts() { return currentTexts; }
export function setCurrentTexts(texts) {
  currentTexts = texts && typeof texts === "object" ? texts : { ...DEFAULT_CLARA_TEXTS };
}

export function isClaraDirty() { return claraDirty; }
export function setClaraDirtyFlag(value) { claraDirty = Boolean(value); }

export function isTextsLoaded() { return textsLoaded; }
export function setTextsLoaded(value) { textsLoaded = Boolean(value); }

export function getTextsRevision() { return textsRevision; }
export function setTextsRevision(value) { textsRevision = value; }

export function getLoadedFormValues() { return loadedFormValues; }
export function setLoadedFormValues(value) { loadedFormValues = value; }

export function isActiveClara() { return activeClara; }
export function setActiveClara(value) { activeClara = value; }

export function isActiveBooking() { return activeBooking; }
export function setActiveBooking(value) { activeBooking = value; }

setChatContext({
  defaults: DEFAULT_CLARA_TEXTS,
  inputs: claraInputs,
  getTexts: () => currentTexts,
  getCustomOptions: () => customMenuOptions,
});
