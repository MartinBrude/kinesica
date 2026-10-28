/**
 * Kinésica Admin - Reglas Clínicas de ATM y Esquema CDI-TTM
 * Define los esquemas de historia clínica, campos obligatorios, coerción de tipos y valores iniciales.
 */

import {
  validateField,
  validateFicha,
  validateStep,
} from "./ficha-rules-validate.mjs";

import {
  normalizeDni,
  stripAccents,
  matchFichaSearch,
  patientKey,
  personNameKey,
  dniNameConflict,
  ownsFicha,
  ageOn,
  PATIENT_FIELDS,
  getUniquePatients,
  getSessionIndex,
  formatSessionBadgeText,
  shouldOmitInvariableFields,
  assignProfesional as assignProfHelper,
} from "./ficha-rules-patient.mjs";

import { emptyFicha, exampleFicha } from "./ficha-rules-defaults.mjs";

export {
  validateField,
  validateFicha,
  validateStep,
  normalizeDni,
  stripAccents,
  matchFichaSearch,
  patientKey,
  personNameKey,
  dniNameConflict,
  ownsFicha,
  ageOn,
  PATIENT_FIELDS,
  getUniquePatients,
  getSessionIndex,
  formatSessionBadgeText,
  shouldOmitInvariableFields,
  emptyFicha,
  exampleFicha,
};

export const REQUIRED_FIELDS = [
  ["nombre", "el nombre completo"],
  ["dni", "el DNI / Pasaporte"],
  ["fechaSesion", "la fecha de la sesión"],
  ["nacimiento", "la fecha de nacimiento"],
  ["edad", "la edad"],
  ["motivo", "el motivo de consulta"],
  ["antecedentes", "los antecedentes clínicos"],
];

export const CLINICIANS = {
  norberto: "Norberto",
  maria: "María",
};

export const CLINICIAN_DETAILS = {
  norberto: {
    nombre: "Lic. Norberto Brude",
    titulo: "Kinesiólogo Fisiatra",
    matricula: "M.N. 11816",
    signatureFile: "/admin/signatures/norberto.png?v=2",
  },
  maria: {
    nombre: "Lic. María Gulin",
    titulo: "Kinesióloga Fisiatra",
    matricula: "M.N. 15322 · M.P. 3112",
    signatureFile: "/admin/signatures/maria.png?v=2",
  },
};

export function missingFieldKeys(data) {
  return REQUIRED_FIELDS
    .filter(([key]) => {
      if (key === "dni" && data?.sinDocumento) return false;
      return !String(data?.[key] ?? "").trim();
    })
    .map(([key]) => key);
}

export function missingFields(data) {
  return REQUIRED_FIELDS
    .filter(([key]) => {
      if (key === "dni" && data?.sinDocumento) return false;
      return !String(data?.[key] ?? "").trim();
    })
    .map(([, label]) => label);
}

export function assignProfesional(username, previous, requested) {
  return assignProfHelper(username, previous, requested, CLINICIANS);
}

export function nextSession(item, fechaSesion) {
  const copy = emptyFicha();
  for (const key of PATIENT_FIELDS) copy[key] = item?.[key] ?? copy[key];
  copy.sinDocumento = Boolean(item?.sinDocumento);
  copy.fechaSesion = fechaSesion || "";
  copy.edad = ageOn(item?.nacimiento, fechaSesion);
  if (CLINICIANS[item?.profesional]) copy.profesional = item.profesional;
  return copy;
}

export function coerceFicha(input = {}) {
  const template = emptyFicha();
  const out = {};
  for (const [key, defaultVal] of Object.entries(template)) {
    const val = input?.[key];
    if (typeof defaultVal === "boolean") {
      out[key] = Boolean(val);
    } else if (typeof defaultVal === "number") {
      const num = Number(val);
      out[key] = Number.isFinite(num) ? num : defaultVal;
    } else if (Array.isArray(defaultVal)) {
      out[key] = Array.isArray(val) ? val.filter((x) => typeof x === "string") : [];
    } else {
      out[key] = val != null ? String(val).trim() : "";
    }
  }
  out.eva = Math.max(0, Math.min(10, Math.round(out.eva || 0)));

  if (out.edad) {
    const cleanEdad = String(out.edad).replace(/\D/g, "");
    const edadNum = parseInt(cleanEdad, 10);
    out.edad = Number.isInteger(edadNum) && edadNum >= 1 && edadNum <= 120 ? String(edadNum) : "";
  }

  for (const mKey of [
    "aperturaLibre", "aperturaDolor", "protrusion", "latIzq", "latDer",
    "aperturaLibrePost", "aperturaDolorPost", "protrusionPost", "latIzqPost", "latDerPost",
  ]) {
    if (out[mKey]) {
      const cleanVal = String(out[mKey]).replace(",", ".").replace(/[^\d.]/g, "");
      const numVal = Number(cleanVal);
      out[mKey] = Number.isFinite(numVal) && numVal >= 0 ? cleanVal : "";
    }
  }

  if (input?.id) out.id = String(input.id);
  if (input?.savedAt) out.savedAt = String(input.savedAt);
  if (input?.profesional) out.profesional = String(input.profesional);
  if (input?.profesionalNombre) out.profesionalNombre = String(input.profesionalNombre);

  if (out.fotoUrl && out.fotosUrls.length === 0) {
    out.fotosUrls = [out.fotoUrl];
  } else if (!out.fotoUrl && out.fotosUrls.length > 0) {
    out.fotoUrl = out.fotosUrls[0];
  }

  return out;
}

export {
  sideText,
  formatSide,
  daysBetween,
  compareFichas,
} from "./ficha-compare.mjs";
