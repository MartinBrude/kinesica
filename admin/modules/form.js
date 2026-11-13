/**
 * Kinésica Admin - Formulario Clínico de ATM (Ficha).
 */

import { patientKey, validateField, getSessionIndex } from "../ficha-rules.mjs?v=90";
import { dialogConfirm } from "./dom.js?v=79";
import { setupInputRestrictions } from "./form-restrictions.js";
import { syncFotoPreview, getCurrentFotos, getUploadInFlight, initFormPhotos } from "./form-photos.js";
import { syncEva, syncAge, syncFollowups, setupSingleButtons } from "./form-eva.js";
import { showStep, showForm as showFormNav, updateStepValidation as updateStepValidationNav, advanceNextStep } from "./form-nav.js";
import { setDniPower, setPatientLocked, populatePatientPicker, setupPatientHandlers, getIdentityKey, isIdentityEdited } from "./form-patient.js";
import { submitFichaForm } from "./form-submit.js";
import { getBlankFicha, readFormData, getFormSerializedState } from "./form-reader.js";
import {
  form,
  evaInput,
  compareFormBtn,
  btnPdfHistory,
  btnBack,
  btnPrev,
  btnNext,
  singles,
  currentId,
  formBaseline,
  activeSessionUserGetter,
  currentAllFichas,
  setCurrentId,
  setFormBaseline,
  setActiveSessionUserGetter,
} from "./form-runtime.js?v=2";
import { fillForm, handleSideChange } from "./form-fill.js?v=2";

export { compressImage } from "./form-image.js";
export { setupInputRestrictions } from "./form-restrictions.js";
export { syncFotoPreview } from "./form-photos.js";
export { todayISO, evaMeta, syncEva, syncAge, syncFollowups } from "./form-eva.js";
export { showStep, highlightMissingFields, highlightErrorFields } from "./form-nav.js";
export { setPatientLocked, populatePatientPicker } from "./form-patient.js";

export function getCurrentId() { return currentId; }
export { setCurrentId } from "./form-runtime.js?v=2";
export function updateStepValidation() { updateStepValidationNav(readForm()); }
export function showForm(targetStep = 0) {
  showFormNav(targetStep, { getCurrentId, onFormShown: () => { setFormBaseline(getFormSerializedState(readForm())); } });
}
export function blank() { return getBlankFicha(); }
export function readForm() { return readFormData({ form, currentId, singles, getCurrentFotos }); }
export function formState() { return getFormSerializedState(readForm()); }
export { fillForm } from "./form-fill.js?v=2";

export function initForm({ onSave, onBack, onCompare, onPrint, getSessionUser }) {
  if (!form) return;
  setActiveSessionUserGetter(getSessionUser);
  setupInputRestrictions(form);
  setupSingleButtons(() => updateStepValidation());
  initFormPhotos();

  document.querySelectorAll("#view-form .steps button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = Number(btn.dataset.step);
      showStep(Number.isInteger(s) ? s : 0);
    });
  });

  if (evaInput) evaInput.addEventListener("input", syncEva);
  ["nacimiento", "fechaSesion"].forEach((f) => {
    form.elements[f]?.addEventListener("change", () => { syncAge(); updateStepValidation(); });
    form.elements[f]?.addEventListener("input", () => { syncAge(); updateStepValidation(); });
  });

  setupPatientHandlers({
    getCurrentAllFichas: () => currentAllFichas,
    onSyncAge: syncAge,
    onValidationChange: updateStepValidation,
    onSelectPatientMotivo: (val) => { singles.motivo = val; },
  });

  form.addEventListener("input", (e) => {
    const alertEl = document.querySelector("#form-step-alert");
    if (alertEl) alertEl.hidden = true;
    if (e.target.classList.contains("input-error") && e.target.value.trim()) {
      if (!validateField(e.target.name, e.target.value, readForm())) {
        e.target.classList.remove("input-error");
        e.target.title = "";
      }
    }
    updateStepValidation();
  });
  form.addEventListener("change", handleSideChange);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const sessionUser = typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null;
    if (sessionUser?.role === "colaborador") return;
    submitFichaForm({
      form,
      data: readForm(),
      allFichas: currentAllFichas,
      identityKey: getIdentityKey(),
      identityEdited: isIdentityEdited(),
      getUploadInFlight,
      onSave,
      onSuccess: (saved) => { setCurrentId(saved.id); },
    });
  });

  btnBack?.addEventListener("click", async () => {
    if (formState() !== formBaseline && !(await dialogConfirm("¿Volver a las fichas sin guardar?"))) return;
    showStep(0);
    if (typeof onBack === "function") onBack();
  });
  btnPrev?.addEventListener("click", () => showStep(Math.max(0, Number(document.querySelector("#view-form .steps button.active")?.dataset.step || 0) - 1)));
  btnNext?.addEventListener("click", () => advanceNextStep(readForm()));
  compareFormBtn?.addEventListener("click", () => {
    const currentItem = readForm();
    if (typeof onCompare === "function") onCompare(patientKey(currentItem), currentId);
  });
  btnPdfHistory?.addEventListener("click", () => {
    const currentItem = readForm();
    const pSessions = currentAllFichas.filter((f) => patientKey(f) === patientKey(currentItem));
    if (typeof onPrint === "function") onPrint(pSessions.length ? pSessions : [currentItem]);
  });
}
