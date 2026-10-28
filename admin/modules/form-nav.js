/**
 * Kinésica Admin - Navegación y Validación Visual de Pasos del Formulario
 */

import { REQUIRED_FIELDS, validateStep, missingFieldKeys, missingFields } from "../ficha-rules.mjs?v=89";
import { switchActiveView, dialogAlert } from "./dom.js?v=78";

const form = document.querySelector("#ficha");
const btnPrev = document.querySelector("#btn-prev");
const btnNext = document.querySelector("#btn-next");

let step = 0;

export function getStep() {
  return step;
}

export function setStep(num) {
  step = num;
}

/**
 * Muestra el panel correspondiente al índice del paso seleccionado (0..5).
 * @param {number} [index=0] Índice del paso
 */
export function showStep(index = 0) {
  const num = Number(index);
  const validStep = (Number.isInteger(num) && num >= 0 && num <= 5) ? num : 0;
  step = validStep;
  document.querySelectorAll("#view-form .panel").forEach((panel) => {
    panel.hidden = Number(panel.dataset.panel) !== validStep;
  });
  document.querySelectorAll("#view-form .steps button").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.step) === validStep);
  });
  if (btnPrev) btnPrev.hidden = validStep === 0;
  if (btnNext) btnNext.hidden = validStep === 5;
}

/**
 * Muestra la vista del formulario clínico y oculta las demás.
 * @param {number} [targetStep=0] Paso inicial a activar (por defecto 0)
 * @param {object} [context={}] Contexto con getCurrentId y setBaseline
 */
export function showForm(targetStep = 0, context = {}) {
  switchActiveView("view-form");
  try {
    window.scrollTo({ top: 0, behavior: "instant" });
  } catch {}
  try {
    const cid = typeof context.getCurrentId === "function" ? context.getCurrentId() : null;
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "form", id: cid }));
  } catch {}
  const initialStep = (typeof targetStep === "number" && Number.isInteger(targetStep) && targetStep >= 0 && targetStep <= 4)
    ? targetStep
    : 0;
  showStep(initialStep);
  if (typeof context.onFormShown === "function") {
    context.onFormShown();
  }
}

/**
 * Actualiza el indicador visual de campos obligatorios en la pestaña del Paso 0.
 * @param {object} data Datos actuales del formulario
 */
export function updateStepValidation(data = {}) {
  const missingKeys = missingFieldKeys(data);
  const step0Val = validateStep(0, data);
  const dot0 = document.querySelector('#view-form .steps button[data-step="0"] .step-dot');
  if (dot0) dot0.hidden = missingKeys.length === 0 && step0Val.isValid;

  const step1Val = validateStep(1, data);
  const dot1 = document.querySelector('#view-form .steps button[data-step="1"] .step-dot');
  if (dot1) dot1.hidden = step1Val.isValid;
}

/**
 * Resalta en rojo suave los campos obligatorios pendientes de completar.
 * @param {string[]} [keys=[]] Lista de identificadores de campos faltantes
 */
export function highlightMissingFields(keys = []) {
  if (!form) return;
  for (const [key] of REQUIRED_FIELDS) {
    const el = form.elements[key];
    if (el) el.classList.toggle("input-error", keys.includes(key));
  }
}

/**
 * Resalta en rojo suave cualquier campo que presente error de tipo o rango.
 * @param {string[]} [keys=[]] Lista de identificadores de campos con error
 */
export function highlightErrorFields(keys = []) {
  if (!form) return;
  const sideConfig = {
    ruidos: { follow: "ruidos", checks: ["ruidosIzq", "ruidosDer"] },
    dolorCondilar: { follow: "dolorCondilar", checks: ["condilarIzq", "condilarDer"] },
    desviacion: { follow: "desviacion", checks: ["desvIzq", "desvDer"] },
    desviacionPost: { follow: "desviacionPost", checks: ["desvIzqPost", "desvDerPost"] },
  };

  keys.forEach((key) => {
    const el = form.elements[key];
    if (el) el.classList.add("input-error");

    if (sideConfig[key]) {
      const cfg = sideConfig[key];
      const fg = form.querySelector(`[data-follow="${cfg.follow}"] .follow-group`);
      if (fg) fg.classList.add("input-error");
      cfg.checks.forEach((chkName) => {
        form.elements[chkName]?.classList.add("input-error");
      });
    }
  });
}

export async function advanceNextStep(data) {
  if (!form) return;
  if (step === 0) {
    const missingKeys = missingFieldKeys(data);
    if (missingKeys.length) {
      highlightMissingFields(missingKeys);
      await dialogAlert(`Falta completar: ${missingFields(data).join(", ")}.`);
      const firstMissing = form.elements[missingKeys[0]] || form.querySelector(".input-error");
      if (firstMissing) firstMissing.focus();
      return;
    }
    const val = validateStep(0, data);
    if (!val.isValid) {
      highlightErrorFields(Object.keys(val.errors));
      await dialogAlert(val.firstError);
      const firstMissing = form.elements[val.firstErrorKey] || form.querySelector(".input-error");
      if (firstMissing) firstMissing.focus();
      return;
    }
  } else if (step === 1) {
    const val = validateStep(1, data);
    if (!val.isValid) {
      highlightErrorFields(Object.keys(val.errors));
      await dialogAlert(val.firstError);
      const sideInputs = {
        ruidos: form.elements.ruidosIzq,
        dolorCondilar: form.elements.condilarIzq,
        desviacion: form.elements.desvIzq,
      };
      const firstMissing = form.elements[val.firstErrorKey] || sideInputs[val.firstErrorKey] || form.querySelector(".input-error");
      if (firstMissing) firstMissing.focus();
      return;
    }
  }
  showStep(Math.min(5, step + 1));
}
