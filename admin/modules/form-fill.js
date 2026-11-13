/**
 * Relleno del formulario y cambios laterales.
 */

import { patientKey, validateField, getSessionIndex } from "../ficha-rules.mjs?v=90";
import { syncFollowups, syncEva } from "./form-eva.js";
import { showStep, updateStepValidation as updateStepValidationNav } from "./form-nav.js";
import { setDniPower, setPatientLocked, populatePatientPicker } from "./form-patient.js";
import { syncFotoPreview } from "./form-photos.js";
import { readFormData, getFormSerializedState } from "./form-reader.js";
import { getCurrentFotos } from "./form-photos.js";
import {
  form,
  singles,
  compareFormBtn,
  btnPdfHistory,
  currentId,
  activeSessionUserGetter,
  currentAllFichas,
  setCurrentId,
  setCurrentAllFichas,
} from "./form-runtime.js?v=2";

function readForm() {
  return readFormData({ form, currentId, singles, getCurrentFotos });
}

function updateStepValidation() {
  updateStepValidationNav(readForm());
}

export function fillForm(data, allFichas = []) {
  if (!form) return;
  setCurrentId(data.id);
  form.reset();
  Object.keys(singles).forEach((k) => delete singles[k]);

  for (const [key, value] of Object.entries(data)) {
    if (key === "id" || key === "savedAt" || key === "cdi") continue;
    const el = form.elements[key];
    if (!el) {
      // version / paciente_id / profesional_id: round-trip sin input visible
      if (key === "version" || key === "paciente_id" || key === "profesional_id") {
        if (value != null && value !== "") singles[key] = value;
        continue;
      }
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
  const isAdmin = sessionUser?.role === "admin";
  const isColaborador = sessionUser?.role === "colaborador";
  const profField = document.querySelector("#field-profesional");
  if (profField) profField.hidden = !isAdmin;
  if (form.elements.profesional) {
    form.elements.profesional.value = data.profesional || (sessionUser?.username === "maria" ? "maria" : "norberto");
  }

  const btnSave = form.querySelector('button[type="submit"]');
  if (btnSave) btnSave.hidden = isColaborador;

  let colabBanner = document.querySelector("#form-colaborador-banner");
  if (isColaborador) {
    if (!colabBanner) {
      colabBanner = document.createElement("div");
      colabBanner.id = "form-colaborador-banner";
      colabBanner.className = "horarios-alert-box";
      colabBanner.style.margin = "16px 0";
      colabBanner.style.background = "#fef3c7";
      colabBanner.style.color = "#92400e";
      colabBanner.style.borderColor = "#fde68a";
      colabBanner.textContent = "👁️ Modo de visualización (Colaborador): Historia clínica en modo solo lectura. Podés imprimirla y compararla, pero no modificarla.";
      form.prepend(colabBanner);
    } else {
      colabBanner.hidden = false;
    }
    form.querySelectorAll("input, textarea, select").forEach((el) => {
      el.disabled = true;
    });
  } else if (colabBanner) {
    colabBanner.hidden = true;
    form.querySelectorAll("input, textarea, select").forEach((el) => {
      el.disabled = false;
    });
  }

  const pSessions = (data.dni || data.nombre)
    ? allFichas.filter((f) => patientKey(f) === patientKey(data))
    : [];
  if (compareFormBtn) compareFormBtn.hidden = pSessions.length < 2;
  if (btnPdfHistory) btnPdfHistory.hidden = pSessions.length < 2;

  setCurrentAllFichas(allFichas);
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

export function handleSideChange(e) {
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
