/**
 * Kinésica Admin - Lectura y Serialización del Formulario de Ficha
 */

import { emptyFicha, coerceFicha, ageOn } from "../ficha-rules.mjs?v=89";
import { todayISO } from "./form-eva.js";

export function getBlankFicha() {
  return {
    id: crypto.randomUUID(),
    savedAt: null,
    ...emptyFicha(),
    fechaSesion: todayISO(),
  };
}

export function readFormData({ form, currentId, singles, getCurrentFotos }) {
  if (!form) return coerceFicha({});
  const raw = {
    id: currentId || crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    ...singles,
  };
  const fd = new FormData(form);
  for (const [key, val] of fd.entries()) {
    if (key !== "cdi") raw[key] = val;
  }
  for (const el of form.querySelectorAll('input[type="checkbox"]')) {
    if (el.name && el.name !== "cdi") raw[el.name] = el.checked;
  }
  raw.cdi = [...form.querySelectorAll('input[name="cdi"]:checked')].map((el) => el.value);
  const evaInput = form.elements.eva;
  if (evaInput) raw.eva = evaInput.value;
  if (document.querySelector("#field-profesional")?.hidden) {
    delete raw.profesional;
  }
  if (!raw.edad && raw.nacimiento) {
    raw.edad = ageOn(raw.nacimiento, raw.fechaSesion || todayISO());
  }
  const dniOn = document.querySelector("#btn-dni-power")?.classList.contains("is-on") !== false;
  raw.sinDocumento = !dniOn;
  if (!dniOn) raw.dni = "";
  const fotos = typeof getCurrentFotos === "function" ? getCurrentFotos() : [];
  raw.fotosUrls = [...fotos];
  raw.fotoUrl = fotos[0] || "";
  return coerceFicha(raw);
}

export function getFormSerializedState(data) {
  const clone = { ...data };
  delete clone.id;
  delete clone.savedAt;
  return JSON.stringify(clone);
}
