/**
 * Kinésica Admin - Formulario Clínico de ATM (Ficha)
 * Administra la captura clínica en 5 pasos, cálculo de edad, escala de dolor EVA,
 * validación suave y soporte para características opcionales.
 */

import {
  emptyFicha,
  coerceFicha,
  missingFieldKeys,
  missingFields,
  ageOn,
  REQUIRED_FIELDS,
  exampleFicha,
  patientKey,
} from "../ficha-rules.mjs";

const form = document.querySelector("#ficha");
const formView = document.querySelector("#view-form");
const evaInput = form ? form.elements.eva : null;
const evaValue = document.querySelector("#eva-value");
const compareFormBtn = document.querySelector("#btn-compare-form");
const btnBack = document.querySelector("#btn-back");
const btnPrev = document.querySelector("#btn-prev");
const btnNext = document.querySelector("#btn-next");
const btnClear = document.querySelector("#btn-clear");
const btnExample = document.querySelector("#btn-example");

let step = 0;
let currentId = null;
let formBaseline = "";
const singles = {};
let activeSessionUserGetter = null;

/**
 * Devuelve la fecha de hoy en formato ISO (YYYY-MM-DD).
 * @returns {string}
 */
export function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Genera una ficha vacía con ID único y fecha actual.
 * @returns {object}
 */
export function blank() {
  return {
    id: crypto.randomUUID(),
    savedAt: null,
    ...emptyFicha(),
    fechaSesion: todayISO(),
  };
}

/**
 * Lee el estado actual del formulario y lo normaliza estrictamente con coerceFicha.
 * @returns {object}
 */
export function readForm() {
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
  if (evaInput) raw.eva = evaInput.value;
  if (document.querySelector("#field-profesional")?.hidden) {
    delete raw.profesional;
  }
  return coerceFicha(raw);
}

/**
 * Serializa los campos clínicos para detectar modificaciones sin guardar.
 * @returns {string}
 */
export function formState() {
  const data = readForm();
  delete data.id;
  delete data.savedAt;
  return JSON.stringify(data);
}

/**
 * Rellena el formulario con los datos de una ficha clínica.
 * @param {object} data Objeto de ficha clínica
 * @param {Array<object>} [allFichas=[]] Colección completa de fichas para verificar historial
 */
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

  const sessionUser = typeof activeSessionUserGetter === "function" ? activeSessionUserGetter() : null;
  const isAdmin = sessionUser?.username === "martin";
  const profField = document.querySelector("#field-profesional");
  if (profField) {
    profField.hidden = !isAdmin;
  }
  if (form.elements.profesional) {
    form.elements.profesional.value = data.profesional || (sessionUser?.username === "maria" ? "maria" : "norberto");
  }

  const pSessions = (data.dni || data.nombre)
    ? allFichas.filter((f) => patientKey(f) === patientKey(data))
    : [];
  if (compareFormBtn) {
    compareFormBtn.hidden = pSessions.length < 2;
  }
}

/**
 * Calcula y sincroniza automáticamente la edad a partir de la fecha de nacimiento y la sesión.
 */
export function syncAge() {
  if (!form) return;
  const birth = form.elements.nacimiento?.value;
  const session = form.elements.fechaSesion?.value || todayISO();
  if (birth) {
    const calculated = ageOn(birth, session);
    if (calculated && form.elements.edad) {
      form.elements.edad.value = calculated;
    }
  }
}

/**
 * Actualiza el indicador visual de campos obligatorios en la pestaña del Paso 0.
 */
export function updateStepValidation() {
  const data = readForm();
  const missingKeys = missingFieldKeys(data);
  const dot = document.querySelector('.steps button[data-step="0"] .step-dot');
  if (dot) dot.hidden = missingKeys.length === 0;
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
 * Retorna etiqueta semántica y nivel de severidad para un valor de la escala EVA.
 * @param {number|string} val Valor entre 0 y 10
 * @returns {{label: string, level: string}}
 */
export function evaMeta(val) {
  const n = Number(val) || 0;
  if (n === 0) return { label: "0 / 10 · Sin dolor", level: "zero" };
  if (n <= 3) return { label: `${n} / 10 · Dolor leve`, level: "mild" };
  if (n <= 6) return { label: `${n} / 10 · Dolor moderado`, level: "moderate" };
  return { label: `${n} / 10 · Dolor severo`, level: "severe" };
}

/**
 * Sincroniza la visualización de la escala EVA con el control deslizante.
 */
export function syncEva() {
  if (!evaInput || !evaValue) return;
  const meta = evaMeta(evaInput.value);
  evaValue.textContent = meta.label;
  evaValue.dataset.level = meta.level;
}

/**
 * Muestra u oculta subpaneles condicionales según los valores seleccionados (ej: ruidos articulares).
 */
export function syncFollowups() {
  document.querySelectorAll("[data-follow]").forEach((box) => {
    const show = singles[box.dataset.follow] === "Sí";
    box.hidden = !show;
    if (!show) {
      box.querySelectorAll("input").forEach((input) => {
        input.checked = false;
      });
    }
  });
}

/**
 * Muestra el panel correspondiente al índice del paso seleccionado (0..4).
 * @param {number} index Índice del paso
 */
export function showStep(index) {
  step = index;
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.hidden = Number(panel.dataset.panel) !== index;
  });
  document.querySelectorAll(".steps button").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.step) === index);
  });
  if (btnPrev) btnPrev.hidden = index === 0;
  if (btnNext) btnNext.hidden = index === 4;
}

/**
 * Muestra la vista del formulario clínico y oculta las demás.
 */
export function showForm() {
  const libraryView = document.querySelector("#view-library");
  const compareView = document.querySelector("#view-compare");
  if (libraryView) libraryView.hidden = true;
  if (compareView) compareView.hidden = true;
  if (formView) formView.hidden = false;
  showStep(step);
  formBaseline = formState();
}

/**
 * Obtiene el ID actual de la ficha en edición.
 * @returns {string|null}
 */
export function getCurrentId() {
  return currentId;
}

/**
 * Establece el ID de la ficha en edición.
 * @param {string|null} id
 */
export function setCurrentId(id) {
  currentId = id;
}

/**
 * Inicializa los controladores de eventos para el formulario clínico.
 * @param {object} callbacks Callbacks de interacción
 * @param {(data: object) => Promise<void>} callbacks.onSave Guardado de la ficha
 * @param {() => void} callbacks.onBack Regreso a la biblioteca
 * @param {(patientKey: string, currentId: string) => void} callbacks.onCompare Solicitud de comparativa
 * @param {(items: object[]) => void} callbacks.onPrint Impresión de la ficha actual
 * @param {(data: object) => void} callbacks.onExportJson Exportación JSON de la ficha actual
 */
export function initForm({ onSave, onBack, onCompare, onPrint, onExportJson, getSessionUser }) {
  if (!form) return;
  activeSessionUserGetter = getSessionUser;

  // Botones de selección única (data-single)
  document.querySelectorAll("[data-single]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn) return;
      const key = group.dataset.single;
      const next = singles[key] === btn.dataset.value ? "" : btn.dataset.value;
      singles[key] = next;
      group.querySelectorAll("button").forEach((el) => {
        el.classList.toggle("on", el.dataset.value === next);
      });
      syncFollowups();
    });
  });

  // Pestañas de navegación por pasos
  document.querySelectorAll(".steps button").forEach((btn) => {
    btn.addEventListener("click", () => showStep(Number(btn.dataset.step)));
  });

  if (evaInput) {
    evaInput.addEventListener("input", syncEva);
  }

  form.elements.nacimiento?.addEventListener("change", () => {
    syncAge();
    updateStepValidation();
  });

  form.elements.fechaSesion?.addEventListener("change", () => {
    syncAge();
    updateStepValidation();
  });

  form.addEventListener("input", (e) => {
    if (e.target.classList.contains("input-error") && e.target.value.trim()) {
      e.target.classList.remove("input-error");
    }
    updateStepValidation();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = readForm();
    const missingKeys = missingFieldKeys(data);
    if (missingKeys.length) {
      showStep(0);
      highlightMissingFields(missingKeys);
      window.alert(`Falta completar: ${missingFields(data).join(", ")}.`);
      const firstMissing = form.elements[missingKeys[0]];
      if (firstMissing) firstMissing.focus();
      return;
    }
    try {
      if (typeof onSave === "function") await onSave(data);
      currentId = data.id;
    } catch (error) {
      if (!error.auth) window.alert(error.message);
    }
  });

  if (btnBack) {
    btnBack.addEventListener("click", () => {
      if (formState() !== formBaseline && !window.confirm("¿Volver a las fichas sin guardar?")) {
        return;
      }
      if (typeof onBack === "function") onBack();
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener("click", () => showStep(Math.max(0, step - 1)));
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      if (step === 0) {
        const data = readForm();
        const missingKeys = missingFieldKeys(data);
        if (missingKeys.length) {
          highlightMissingFields(missingKeys);
          const firstMissing = form.elements[missingKeys[0]] || form.querySelector(".input-error");
          if (firstMissing) firstMissing.focus();
          return;
        }
      }
      showStep(Math.min(4, step + 1));
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      const id = currentId;
      const fresh = blank();
      fresh.id = id || fresh.id;
      fillForm(fresh);
      showStep(0);
    });
  }

  if (btnExample) {
    btnExample.addEventListener("click", () => {
      const sample = blank();
      sample.id = currentId || sample.id;
      Object.assign(sample, exampleFicha());
      fillForm(sample);
    });
  }

  if (compareFormBtn) {
    compareFormBtn.addEventListener("click", () => {
      const currentItem = readForm();
      if (typeof onCompare === "function") {
        onCompare(patientKey(currentItem), currentId);
      }
    });
  }

  const btnExportOne = document.querySelector("#btn-export-one");
  if (btnExportOne) {
    btnExportOne.addEventListener("click", () => {
      if (typeof onExportJson === "function") onExportJson(readForm());
    });
  }

  const btnPdfOne = document.querySelector("#btn-pdf-one");
  if (btnPdfOne) {
    btnPdfOne.addEventListener("click", () => {
      if (typeof onPrint === "function") onPrint([readForm()]);
    });
  }
}
