import { getSessionUser } from "./auth.js?v=83";
import { getNextAvailableLetter, renderCustomOptionsList } from "./config-options.js";
import { applyMailPreviewReadOnly } from "./mail-preview.js?v=2";
import {
  btnSaveGlobal,
  btnSaveMailsPolicies,
  btnAddCustomOption,
  dirtyBadge,
  textsStatusBanner,
  customOptionsContainer,
  customOptionsEmpty,
  tog,
  getCustomMenuOptions,
  setCustomMenuOptions,
  isClaraDirty,
  setClaraDirtyFlag,
  isTextsLoaded,
} from "./configuracion-state.js";
import { dialogAlert } from "./dom.js?v=79";

export function isColaboradorUser() {
  return getSessionUser()?.role === "colaborador";
}

export function setClaraDirty(next) {
  if (isColaboradorUser()) {
    setClaraDirtyFlag(false);
  } else {
    setClaraDirtyFlag(Boolean(next));
  }
  const claraDirty = isClaraDirty();
  if (dirtyBadge) dirtyBadge.hidden = !claraDirty;
  if (btnSaveGlobal) {
    btnSaveGlobal.disabled = !claraDirty || isColaboradorUser();
    if (!claraDirty && !btnSaveGlobal.textContent.includes("Guardando") && !btnSaveGlobal.textContent.includes("Guardado")) {
      btnSaveGlobal.textContent = "Guardar cambios";
    }
  }
}

export function markClaraDirty() {
  if (isColaboradorUser() || !isTextsLoaded()) return;
  setClaraDirty(true);
}

export function clearClaraDirty() {
  setClaraDirty(false);
}

export function refreshCustomOptionsList(markDirty) {
  renderCustomOptionsList(
    customOptionsContainer,
    customOptionsEmpty,
    getCustomMenuOptions(),
    dialogAlert,
    markDirty || markClaraDirty
  );
}

export function applyColaboradorReadOnly() {
  if (!isColaboradorUser()) return;
  if (btnSaveGlobal) btnSaveGlobal.hidden = true;
  if (btnSaveMailsPolicies) btnSaveMailsPolicies.hidden = true;
  if (btnAddCustomOption) btnAddCustomOption.hidden = true;
  if (dirtyBadge) dirtyBadge.hidden = true;
  document.querySelectorAll("#view-clara input, #view-clara textarea").forEach((el) => {
    el.readOnly = true;
  });
  document.querySelectorAll("#view-clara select, #view-clara input[type='checkbox']").forEach((el) => {
    el.disabled = true;
  });
  applyMailPreviewReadOnly(true);
  if (tog.cfgClaraToggleBtn) tog.cfgClaraToggleBtn.disabled = true;
  if (tog.cfgBookingToggleBtn) tog.cfgBookingToggleBtn.disabled = true;
  if (textsStatusBanner) {
    textsStatusBanner.hidden = false;
    textsStatusBanner.style.background = "#fef3c7";
    textsStatusBanner.style.color = "#92400e";
    textsStatusBanner.style.borderColor = "#fde68a";
    textsStatusBanner.textContent = "Modo solo lectura (Colaborador): podés consultar los textos de Clara, pero no modificarlos.";
  }
}

export function isMailPreviewField(el) {
  const id = el?.id || "";
  return id === "btn-send-confirmation-preview" || id.startsWith("cfg-mail-preview-");
}

export function bindClaraDirtyListeners() {
  const view = document.getElementById("view-clara");
  if (!view || view.dataset.dirtyBound === "1") return;
  view.dataset.dirtyBound = "1";
  view.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (isMailPreviewField(target)) return;
    if (target.matches("textarea, input, select")) markClaraDirty();
  });
  view.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (isMailPreviewField(target)) return;
    if (target.matches("textarea, input, select")) markClaraDirty();
  });
}

export function addCustomMenuOption() {
  if (isColaboradorUser()) return;
  const nextL = getNextAvailableLetter(getCustomMenuOptions());
  setCustomMenuOptions([...getCustomMenuOptions(), { letter: nextL, label: "", response: "" }]);
  refreshCustomOptionsList(markClaraDirty);
  markClaraDirty();
}
