/**
 * Validación por paso del formulario de ficha.
 */

import { validateField } from "./ficha-rules-validate-fields.mjs";

/**
 * Valida los campos correspondientes a un paso específico del formulario.
 * @param {number} stepNumber Número de paso (0 a 4)
 * @param {object} data Datos del formulario
 */
export function validateStep(stepNumber, data = {}) {
  data = data || {};
  const stepFields = {
    0: ["nombre", "dni", "fechaSesion", "nacimiento", "edad", "motivo", "antecedentes"],
    1: [
      "ruidos",
      "dolorCondilar",
      "aperturaLibre",
      "aperturaDolor",
      "desviacion",
      "protrusion",
      "latIzq",
      "latDer",
      "aperturaLibrePost",
      "aperturaDolorPost",
      "desviacionPost",
      "protrusionPost",
      "latIzqPost",
      "latDerPost",
    ],
    2: [],
    3: ["eva"],
    4: [],
    5: ["anotaciones", "fotoUrl", "fotosUrls"],
  };
  const fields = stepFields[stepNumber] || [];
  const errors = {};
  const errorList = [];
  for (const f of fields) {
    const err = validateField(f, data[f], data);
    if (err) {
      errors[f] = err;
      errorList.push(err);
    }
  }
  return {
    isValid: errorList.length === 0,
    errors,
    errorList,
    firstErrorKey: Object.keys(errors)[0] || null,
    firstError: errorList[0] || null,
  };
}
