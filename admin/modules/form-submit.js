/**
 * Kinésica Admin - Validación y Envío del Formulario Clínico
 */

import {
  missingFieldKeys,
  missingFields,
  validateFicha,
  dniNameConflict,
  patientKey,
} from "../ficha-rules.mjs?v=89";
import { dialogAlert } from "./dom.js?v=78";
import { showStep, highlightMissingFields, highlightErrorFields } from "./form-nav.js";

const stepForField = {
  nombre: 0,
  dni: 0,
  fechaSesion: 0,
  nacimiento: 0,
  edad: 0,
  lugarNac: 0,
  motivo: 0,
  antecedentes: 0,
  ruidos: 1,
  dolorCondilar: 1,
  aperturaLibre: 1,
  aperturaDolor: 1,
  desviacion: 1,
  protrusion: 1,
  latIzq: 1,
  latDer: 1,
  eva: 3,
};

export async function submitFichaForm({
  form,
  data,
  allFichas,
  identityKey,
  identityEdited,
  getUploadInFlight,
  onSave,
  onSuccess,
}) {
  const missingKeys = missingFieldKeys(data);
  if (missingKeys.length) {
    showStep(0);
    highlightMissingFields(missingKeys);
    await dialogAlert(`Falta completar: ${missingFields(data).join(", ")}.`);
    const firstMissing = form.elements[missingKeys[0]];
    if (firstMissing) firstMissing.focus();
    return false;
  }

  const val = validateFicha(data);
  if (!val.isValid) {
    const targetStep = stepForField[val.firstErrorKey] ?? 0;
    showStep(targetStep);
    highlightErrorFields(Object.keys(val.errors));
    await dialogAlert(val.firstError);
    const sideInputs = {
      ruidos: form.elements.ruidosIzq,
      dolorCondilar: form.elements.condilarIzq,
      desviacion: form.elements.desvIzq,
    };
    const firstMissing = form.elements[val.firstErrorKey] || sideInputs[val.firstErrorKey] || form.querySelector(".input-error");
    if (firstMissing) firstMissing.focus();
    return false;
  }

  const ownKey = identityKey || patientKey(allFichas.find((ficha) => ficha.id === data.id) || {});
  const clash = dniNameConflict(data, allFichas, ownKey);
  if (clash) {
    showStep(0);
    form.elements.dni?.classList.add("input-error");
    await dialogAlert(`El documento ${clash.dni || data.dni} ya corresponde a ${clash.nombre}. No se puede guardar con otro nombre.`);
    form.elements.dni?.focus();
    return false;
  }

  const uploadTask = typeof getUploadInFlight === "function" ? getUploadInFlight() : null;
  if (uploadTask) {
    try {
      await uploadTask;
    } catch {}
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
    if (typeof onSave === "function") {
      await onSave(data, identityEdited && identityKey ? { identityKey } : null);
    }
    if (typeof onSuccess === "function") onSuccess(data);
    showStep(0);
    return true;
  } catch (error) {
    if (!error.auth) await dialogAlert(error.message);
    return false;
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}
