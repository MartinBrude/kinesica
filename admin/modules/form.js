/**
 * Kinésica Admin - Formulario Clínico de ATM (Ficha)
 * Administra la captura clínica en 5 pasos, cálculo de edad, escala de dolor EVA,
 * validación suave y soporte para características opcionales.
 */

import { patientKey, validateField, getSessionIndex } from "../ficha-rules.mjs?v=89";
import { dialogConfirm } from "./dom.js?v=78";
import { setupInputRestrictions } from "./form-restrictions.js";
import { syncFotoPreview, getCurrentFotos, getUploadInFlight, initFormPhotos } from "./form-photos.js";
import { singles, todayISO, evaMeta, syncEva, syncAge, syncFollowups, setupSingleButtons } from "./form-eva.js";
import { showStep, showForm as showFormNav, updateStepValidation as updateStepValidationNav, highlightMissingFields, highlightErrorFields, advanceNextStep } from "./form-nav.js";
import { setDniPower, setPatientLocked, populatePatientPicker, setupPatientHandlers, getIdentityKey, isIdentityEdited } from "./form-patient.js";
import { submitFichaForm } from "./form-submit.js";
import { getBlankFicha, readFormData, getFormSerializedState } from "./form-reader.js";

export { compressImage } from "./form-image.js";
export { setupInputRestrictions } from "./form-restrictions.js";
export { syncFotoPreview } from "./form-photos.js";
export { todayISO, evaMeta, syncEva, syncAge, syncFollowups } from "./form-eva.js";
export { showStep, highlightMissingFields, highlightErrorFields } from "./form-nav.js";
export { setPatientLocked, populatePatientPicker } from "./form-patient.js";

const form = document.querySelector("#ficha");
const evaInput = form ? form.elements.eva : null;
const compareFormBtn = document.querySelector("#btn-compare-form");
const btnPdfHistory = document.querySelector("#btn-pdf-history");
const btnBack = document.querySelector("#btn-back");
const btnPrev = document.querySelector("#btn-prev");
const btnNext = document.querySelector("#btn-next");

let currentId = null;
let formBaseline = "";
let activeSessionUserGetter = null;
let currentAllFichas = [];

export function getCurrentId() { return currentId; }
export function setCurrentId(id) { currentId = id; }
export function updateStepValidation() { updateStepValidationNav(readForm()); }

export function showForm(targetStep = 0) {
  showFormNav(targetStep, { getCurrentId, onFormShown: () => { formBaseline = formState(); } });
}

export function blank() { return getBlankFicha(); }
export function readForm() { return readFormData({ form, currentId, singles, getCurrentFotos }); }
export function formState() { return getFormSerializedState(readForm()); }

export function fillForm(data, allFichas = []) {
  if (!form) return;
  currentId = data.id;
  form.reset();
  Object.keys(singles).forEach((k) => delete singles[k]);

  for (const [key, value] of Object.entries(data)) {
    if (key === "id" || key === "savedAt" || key === "cdi") continue;
    const el = form.elements[key];
    if (!el) {
      if (form.querySelector(`[data-single="${key}"]`)) singles[key] = value || "";
      continue;
    }
    if (el instanceof RadioNodeList || el instanceof HTMLCollection) {
      for (const node of el) {
        if (node.type === "checkbox") node.checked = Boolean(value);
        else node.value = value ?? "";
      }
      continue;
    }
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = value ?? "";
  }

  for (const el of form.querySelectorAll('input[name="cdi"]')) {
    el.checked = (data.cdi || []).includes(el.value);
  }

  document.querySelectorAll("[data-single]").forEach((group) => {
    const key = group.dataset.single;
    group.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.value === (data[key] || ""));
    });
    if (data[key]) singles[key] = data[key];
  });

  syncFollowups();
  syncEva();
  updateStepValidation();

  const preAccordion = form.querySelector(".mediciones-accordion");
  if (preAccordion) preAccordion.open = true;

  const postAccordion = document.querySelector("#details-mediciones-post");
  if (postAccordion) {
    postAccordion.open = Boolean(
      data.aperturaLibrePost || data.aperturaDolorPost || data.desviacionPost ||
      data.desvIzqPost || data.desvDerPost || data.desvCorregidaPost ||
      data.deflexionPost || data.protrusionPost || data.latIzqPost || data.latDerPost
    );
  }

  const sessionUser = typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null;
  const isAdmin = sessionUser?.role === "admin" || sessionUser?.username === "martin";
  const profField = document.querySelector("#field-profesional");
  if (profField) profField.hidden = !isAdmin;
  if (form.elements.profesional) {
    form.elements.profesional.value = data.profesional || (sessionUser?.username === "maria" ? "maria" : "norberto");
  }

  const pSessions = (data.dni || data.nombre)
    ? allFichas.filter((f) => patientKey(f) === patientKey(data))
    : [];
  if (compareFormBtn) compareFormBtn.hidden = pSessions.length < 2;
  if (btnPdfHistory) btnPdfHistory.hidden = pSessions.length < 2;

  currentAllFichas = allFichas;
  const pKey = (data.dni || data.nombre) ? patientKey(data) : "";
  populatePatientPicker(allFichas, pKey);
  if (pKey && pSessions.length > 0) {
    const isEdit = allFichas.some((f) => f.id === data.id);
    const sessionIdx = getSessionIndex(data, allFichas);
    setPatientLocked(true, data, isEdit ? sessionIdx : pSessions.length, isEdit);
  } else {
    setPatientLocked(false);
  }
  setDniPower(!data?.sinDocumento);
  const initialFotos = Array.isArray(data?.fotosUrls) && data.fotosUrls.length > 0
    ? data.fotosUrls
    : (data?.fotoUrl ? [data.fotoUrl] : []);
  syncFotoPreview(initialFotos);
  showStep(0);
}

function handleSideChange(e) {
  const sideMap = {
    ruidosIzq: "ruidos", ruidosDer: "ruidos",
    condilarIzq: "dolorCondilar", condilarDer: "dolorCondilar",
    desvIzq: "desviacion", desvDer: "desviacion",
    desvIzqPost: "desviacionPost", desvDerPost: "desviacionPost",
  };
  const key = sideMap[e.target?.name];
  if (key) {
    const data = readForm();
    if (!validateField(key, data[key], data)) {
      const followName = key.startsWith("desv") ? (key.endsWith("Post") ? "desviacionPost" : "desviacion") : key;
      const fg = form.querySelector(`[data-follow="${followName}"] .follow-group`);
      if (fg) fg.classList.remove("input-error");
      e.target.classList.remove("input-error");
    }
  }
  updateStepValidation();
}

export function initForm({ onSave, onBack, onCompare, onPrint, getSessionUser }) {
  if (!form) return;
  activeSessionUserGetter = getSessionUser;
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
    submitFichaForm({
      form,
      data: readForm(),
      allFichas: currentAllFichas,
      identityKey: getIdentityKey(),
      identityEdited: isIdentityEdited(),
      getUploadInFlight,
      onSave,
      onSuccess: (saved) => { currentId = saved.id; },
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
