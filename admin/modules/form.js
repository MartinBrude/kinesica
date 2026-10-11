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
  patientKey,
  dniNameConflict,
  validateField,
  validateFicha,
  validateStep,
  getUniquePatients,
  getSessionIndex,
} from "../ficha-rules.mjs?v=82";
import { dialogAlert, dialogConfirm } from "./dom.js?v=78";

const form = document.querySelector("#ficha");
const formView = document.querySelector("#view-form");
const evaInput = form ? form.elements.eva : null;
const evaValue = document.querySelector("#eva-value");
const compareFormBtn = document.querySelector("#btn-compare-form");
const btnPdfHistory = document.querySelector("#btn-pdf-history");
const btnBack = document.querySelector("#btn-back");
const btnPrev = document.querySelector("#btn-prev");
const btnNext = document.querySelector("#btn-next");

let step = 0;
let currentId = null;
let formBaseline = "";
const singles = {};
let activeSessionUserGetter = null;
let currentAllFichas = [];
let identityKey = "";
let identityEdited = false;

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
  if (!raw.edad && raw.nacimiento) {
    raw.edad = ageOn(raw.nacimiento, raw.fechaSesion || todayISO());
  }
  const dniOn = document.querySelector("#btn-dni-power")?.classList.contains("is-on") !== false;
  raw.sinDocumento = !dniOn;
  if (!dniOn) raw.dni = "";
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
  step = 0;
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
  if (btnPdfHistory) {
    btnPdfHistory.hidden = pSessions.length < 2;
  }

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
  showStep(0);
}

function setDniPower(on, { clear = false } = {}) {
  const btn = document.querySelector("#btn-dni-power");
  const input = form?.elements.dni;
  const locked = document.querySelector("#patient-fixed-section")?.classList.contains("is-locked");
  if (btn) {
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.title = on
      ? "Documento obligatorio. Tocá para no pedirlo."
      : "Sin documento. Tocá para volver a pedirlo.";
  }
  if (!input) return;
  if (!on) {
    if (clear) input.value = "";
    input.disabled = true;
    input.required = false;
    input.readOnly = true;
    input.classList.remove("input-error");
    return;
  }
  input.disabled = false;
  input.required = true;
  input.readOnly = Boolean(locked);
}

/**
 * Bloquea o desbloquea los campos de filiación fija del paciente y actualiza badges de estado.
 * @param {boolean} locked Si los campos deben quedar protegidos
 * @param {object|null} patientData Datos del paciente
 * @param {number} sessionCount Cantidad de sesiones registradas
 * @param {boolean} isEdit Si se está editando una sesión guardada previamente
 * @param {boolean} keepValues Si se deben conservar los valores al desbloquear
 */
export function setPatientLocked(locked, patientData = null, sessionCount = 0, isEdit = false, keepValues = false) {
  const fixedSection = document.querySelector("#patient-fixed-section");
  const banner = document.querySelector("#patient-status-banner");
  const nameSpan = document.querySelector("#patient-status-name");
  const dniSpan = document.querySelector("#patient-status-dni");
  const sessionsSpan = document.querySelector("#patient-status-sessions");
  const newToggle = document.querySelector("#btn-patient-new-toggle");
  const sessionBadge = document.querySelector("#session-count-badge");

  const inputs = [
    form?.elements.nombre,
    form?.elements.dni,
    form?.elements.nacimiento,
    form?.elements.lugarNac,
    form?.elements.antecedentes,
  ].filter(Boolean);

  const habitChecks = [
    form?.elements.habitoApretamiento,
    form?.elements.habitoBruxismo,
    form?.elements.habitoMasticacionUni,
    form?.elements.habitoOnicofagia,
  ].filter(Boolean);

  const editBtn = document.querySelector("#btn-edit-primary");
  if (locked) {
    identityKey = patientKey(patientData || {});
    identityEdited = false;
    if (fixedSection) fixedSection.classList.add("is-locked");
    inputs.forEach((input) => (input.readOnly = true));
    habitChecks.forEach((chk) => (chk.disabled = true));
    document.querySelectorAll('[data-single="motivo"] button').forEach((btn) => (btn.disabled = true));
    if (banner) banner.hidden = false;
    if (newToggle) newToggle.hidden = false;
    if (nameSpan) nameSpan.textContent = patientData?.nombre || form?.elements.nombre?.value || "";
    if (dniSpan) dniSpan.textContent = patientData?.dni || form?.elements.dni?.value || "—";
    if (sessionsSpan) {
      sessionsSpan.textContent = sessionCount > 0
        ? `${sessionCount} ${sessionCount === 1 ? "sesión registrada" : "sesiones registradas"}`
        : "Sin sesiones previas";
    }
    if (sessionBadge) {
      if (isEdit) {
        sessionBadge.textContent = sessionCount > 0 ? `Editando Sesión N° ${sessionCount}` : "Editando ficha";
      } else {
        sessionBadge.textContent = sessionCount > 0 ? `Nueva consulta · Sesión N° ${sessionCount + 1}` : "1ª Consulta · Evaluación inicial";
      }
    }
    if (editBtn) editBtn.hidden = false;
  } else {
    if (fixedSection) fixedSection.classList.remove("is-locked");
    inputs.forEach((input) => (input.readOnly = false));
    habitChecks.forEach((chk) => (chk.disabled = false));
    document.querySelectorAll('[data-single="motivo"] button').forEach((btn) => (btn.disabled = false));
    if (banner) banner.hidden = true;
    if (newToggle) newToggle.hidden = true;
    if (sessionBadge && !keepValues) {
      sessionBadge.textContent = "1ª Consulta · Evaluación inicial";
    }
    if (editBtn) editBtn.hidden = true;
    if (keepValues) identityEdited = true;
    else {
      identityKey = "";
      identityEdited = false;
    }
  }
  const powerBtn = document.querySelector("#btn-dni-power");
  if (powerBtn) powerBtn.disabled = locked;
  setDniPower(powerBtn ? powerBtn.classList.contains("is-on") : true);
}

/**
 * Llena el selector rápido de pacientes existentes a partir de la lista general de fichas.
 * @param {Array<object>} allFichas
 * @param {string} selectedKey
 */
export function populatePatientPicker(allFichas = [], selectedKey = "") {
  const select = document.querySelector("#patient-quick-select");
  if (!select) return;
  const patients = getUniquePatients(allFichas);
  select.innerHTML = '<option value="">— Cargar nuevo paciente (o seleccionar existente) —</option>';
  for (const p of patients) {
    const opt = document.createElement("option");
    opt.value = p.key;
    opt.textContent = `${p.nombre} (DNI ${p.dni || "—"}) · ${p.sessions.length} ses.`;
    select.append(opt);
  }
  select.value = selectedKey || "";
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
      const num = parseInt(calculated, 10);
      if (Number.isInteger(num) && num >= 1 && num <= 120) {
        form.elements.edad.value = String(num);
        form.elements.edad.classList.remove("input-error");
        form.elements.edad.title = "";
      }
    }
  }
}

/**
 * Actualiza el indicador visual de campos obligatorios en la pestaña del Paso 0.
 */
export function updateStepValidation() {
  const data = readForm();
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

/**
 * Configura restricciones en tiempo real para evitar que se ingrese texto en campos numéricos
 * y garantizar tipos de datos válidos.
 * @param {HTMLFormElement} formEl Formulario clínico
 */
export function setupInputRestrictions(formEl) {
  if (!formEl) return;

  // 1. Entero estricto: Edad (1 a 120) - No permite texto ni símbolos ni números fuera de rango
  const edadInput = formEl.elements.edad;
  if (edadInput) {
    edadInput.addEventListener("keydown", (e) => {
      if (
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "Tab" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "Enter" ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }
      // Bloquear cualquier tecla que no sea dígito
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    });

    edadInput.addEventListener("input", () => {
      let clean = edadInput.value.replace(/\D/g, "");
      if (clean.length > 3) clean = clean.slice(0, 3);
      if (edadInput.value !== clean) {
        edadInput.value = clean;
      }
      if (clean) {
        const n = Number(clean);
        const valid = Number.isInteger(n) && n >= 1 && n <= 120;
        edadInput.classList.toggle("input-error", !valid);
        edadInput.title = valid ? "" : "La edad debe ser un número entero entre 1 y 120";
      } else {
        edadInput.title = "";
      }
    });
  }

  // 2. Mediciones mandibulares (milímetros: decimal o entero >= 0) - No permiten texto
  const measurementNames = ["aperturaLibre", "aperturaDolor", "protrusion", "latIzq", "latDer"];
  measurementNames.forEach((name) => {
    const el = formEl.elements[name];
    if (!el) return;

    el.addEventListener("keydown", (e) => {
      if (
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "Tab" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "Enter" ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }
      // Permitir separador decimal solo una vez
      if (e.key === "." || e.key === ",") {
        if (el.value.includes(".") || el.value.includes(",")) {
          e.preventDefault();
        }
        return;
      }
      // Bloquear texto y otros caracteres
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    });

    el.addEventListener("input", () => {
      let val = el.value.replace(",", ".");
      val = val.replace(/[^\d.]/g, "");
      const parts = val.split(".");
      if (parts.length > 2) {
        val = parts[0] + "." + parts.slice(1).join("");
      }
      if (el.value !== val) {
        el.value = val;
      }
      if (val) {
        const maxVal = 500;
        const n = Number(val);
        const valid = !Number.isNaN(n) && n >= 0 && n <= maxVal;
        el.classList.toggle("input-error", !valid);
        el.title = valid ? "" : "Debe ser un número entre 0 y 500 mm";
      } else {
        el.title = "";
      }
    });
  });

  // 3. Documento (DNI / Pasaporte): permite números, letras y formato (. y -)
  const dniInput = formEl.elements.dni;
  if (dniInput) {
    dniInput.addEventListener("input", () => {
      const clean = dniInput.value.replace(/[^a-zA-Z0-9.\s-]/g, "");
      if (dniInput.value !== clean) {
        dniInput.value = clean;
      }
    });
  }

  // 4. Nombre completo: no permite dígitos
  const nombreInput = formEl.elements.nombre;
  if (nombreInput) {
    nombreInput.addEventListener("keydown", (e) => {
      if (
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "Tab" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "Enter" ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    });

    nombreInput.addEventListener("input", () => {
      const clean = nombreInput.value.replace(/\d/g, "");
      if (nombreInput.value !== clean) {
        nombreInput.value = clean;
      }
    });
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
        input.classList.remove("input-error");
      });
      box.querySelectorAll(".follow-group").forEach((fg) => {
        fg.classList.remove("input-error");
      });
    }
  });
}

/**
 * Muestra el panel correspondiente al índice del paso seleccionado (0..4).
 * @param {number} [index=0] Índice del paso
 */
export function showStep(index = 0) {
  const num = Number(index);
  const validStep = (Number.isInteger(num) && num >= 0 && num <= 4) ? num : 0;
  step = validStep;
  document.querySelectorAll("#view-form .panel").forEach((panel) => {
    panel.hidden = Number(panel.dataset.panel) !== validStep;
  });
  document.querySelectorAll("#view-form .steps button").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.step) === validStep);
  });
  if (btnPrev) btnPrev.hidden = validStep === 0;
  if (btnNext) btnNext.hidden = validStep === 4;
}

/**
 * Muestra la vista del formulario clínico y oculta las demás.
 * @param {number} [targetStep=0] Paso inicial a activar (por defecto 0)
 */
export function showForm(targetStep = 0) {
  const libraryView = document.querySelector("#view-library");
  const compareView = document.querySelector("#view-compare");
  const gateView = document.querySelector("#view-gate");
  if (gateView) gateView.hidden = true;
  if (libraryView) libraryView.hidden = true;
  if (compareView) compareView.hidden = true;
  if (formView) {
    formView.hidden = false;
    try {
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch {}
  }
  try {
    sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "form", id: currentId }));
  } catch {}
  const initialStep = (typeof targetStep === "number" && Number.isInteger(targetStep) && targetStep >= 0 && targetStep <= 4)
    ? targetStep
    : 0;
  showStep(initialStep);
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
 */
export function initForm({ onSave, onBack, onCompare, onPrint, getSessionUser }) {
  if (!form) return;
  activeSessionUserGetter = getSessionUser;
  setupInputRestrictions(form);

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
      updateStepValidation();
    });
  });

  // Pestañas de navegación por pasos (restringidas al formulario)
  document.querySelectorAll("#view-form .steps button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = Number(btn.dataset.step);
      showStep(Number.isInteger(s) ? s : 0);
    });
  });

  if (evaInput) {
    evaInput.addEventListener("input", syncEva);
  }

  form.elements.nacimiento?.addEventListener("change", () => {
    syncAge();
    updateStepValidation();
  });
  form.elements.nacimiento?.addEventListener("input", () => {
    syncAge();
    updateStepValidation();
  });

  form.elements.fechaSesion?.addEventListener("change", () => {
    syncAge();
    updateStepValidation();
  });
  form.elements.fechaSesion?.addEventListener("input", () => {
    syncAge();
    updateStepValidation();
  });

  const patientSelect = document.querySelector("#patient-quick-select");
  if (patientSelect) {
    patientSelect.addEventListener("change", () => {
      const selectedKey = patientSelect.value;
      if (!selectedKey) {
        setPatientLocked(false);
        setDniPower(true);
        form.elements.nombre.value = "";
        form.elements.dni.value = "";
        form.elements.nacimiento.value = "";
        form.elements.lugarNac.value = "";
        form.elements.edad.value = "";
        singles.motivo = "";
        document.querySelectorAll('[data-single="motivo"] button').forEach((b) => b.classList.remove("on"));
        if (form.elements.habitoApretamiento) form.elements.habitoApretamiento.checked = false;
        if (form.elements.habitoBruxismo) form.elements.habitoBruxismo.checked = false;
        if (form.elements.habitoMasticacionUni) form.elements.habitoMasticacionUni.checked = false;
        if (form.elements.habitoOnicofagia) form.elements.habitoOnicofagia.checked = false;
        if (form.elements.antecedentes) form.elements.antecedentes.value = "";
        form.elements.nombre.focus();
        updateStepValidation();
        return;
      }
      const all = currentAllFichas || [];
      const match = all.find((f) => patientKey(f) === selectedKey);
      if (match) {
        form.elements.nombre.value = match.nombre || "";
        form.elements.dni.value = match.dni || "";
        form.elements.nacimiento.value = match.nacimiento || "";
        form.elements.lugarNac.value = match.lugarNac || "";

        // Copiar motivo de consulta de la sesión previa
        if (match.motivo) {
          singles.motivo = match.motivo;
          document.querySelectorAll('[data-single="motivo"] button').forEach((btn) => {
            btn.classList.toggle("on", btn.dataset.value === match.motivo);
          });
        }

        // Copiar hábitos de la sesión previa
        if (form.elements.habitoApretamiento) form.elements.habitoApretamiento.checked = Boolean(match.habitoApretamiento);
        if (form.elements.habitoBruxismo) form.elements.habitoBruxismo.checked = Boolean(match.habitoBruxismo);
        if (form.elements.habitoMasticacionUni) form.elements.habitoMasticacionUni.checked = Boolean(match.habitoMasticacionUni);
        if (form.elements.habitoOnicofagia) form.elements.habitoOnicofagia.checked = Boolean(match.habitoOnicofagia);

        if (match.antecedentes) {
          form.elements.antecedentes.value = match.antecedentes;
        }
        syncAge();
        const pSessions = all.filter((f) => patientKey(f) === selectedKey);
        setDniPower(!match.sinDocumento, { clear: Boolean(match.sinDocumento) });
        setPatientLocked(true, match, pSessions.length, false);
        updateStepValidation();
        form.elements.fechaSesion?.focus();
      }
    });
  }

  const dniPowerBtn = document.querySelector("#btn-dni-power");
  if (dniPowerBtn) {
    dniPowerBtn.addEventListener("click", () => {
      if (dniPowerBtn.disabled) return;
      const on = dniPowerBtn.classList.contains("is-on");
      setDniPower(!on, { clear: on });
      updateStepValidation();
    });
  }

  const editBtn = document.querySelector("#btn-edit-primary");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      setPatientLocked(false, null, 0, false, true);
      form.elements.nombre?.focus();
    });
  }

  const newToggleBtn = document.querySelector("#btn-patient-new-toggle");
  if (newToggleBtn) {
    newToggleBtn.addEventListener("click", () => {
      if (patientSelect) patientSelect.value = "";
      setPatientLocked(false);
      setDniPower(true);
      form.elements.nombre.value = "";
      form.elements.dni.value = "";
      form.elements.nacimiento.value = "";
      form.elements.lugarNac.value = "";
      form.elements.edad.value = "";
      singles.motivo = "";
      document.querySelectorAll('[data-single="motivo"] button').forEach((b) => b.classList.remove("on"));
      if (form.elements.habitoApretamiento) form.elements.habitoApretamiento.checked = false;
      if (form.elements.habitoBruxismo) form.elements.habitoBruxismo.checked = false;
      if (form.elements.habitoMasticacionUni) form.elements.habitoMasticacionUni.checked = false;
      if (form.elements.habitoOnicofagia) form.elements.habitoOnicofagia.checked = false;
      if (form.elements.antecedentes) form.elements.antecedentes.value = "";
      form.elements.nombre?.focus();
      updateStepValidation();
    });
  }

  form.addEventListener("input", (e) => {
    if (e.target.classList.contains("input-error") && e.target.value.trim()) {
      const err = validateField(e.target.name, e.target.value, readForm());
      if (!err) {
        e.target.classList.remove("input-error");
        e.target.title = "";
      }
    }
    updateStepValidation();
  });

  form.addEventListener("change", (e) => {
    const sideMap = {
      ruidosIzq: "ruidos",
      ruidosDer: "ruidos",
      condilarIzq: "dolorCondilar",
      condilarDer: "dolorCondilar",
      desvIzq: "desviacion",
      desvDer: "desviacion",
    };
    const key = sideMap[e.target?.name];
    if (key) {
      const data = readForm();
      const err = validateField(key, data[key], data);
      if (!err) {
        const sideConfig = {
          ruidos: { follow: "ruidos", checks: ["ruidosIzq", "ruidosDer"] },
          dolorCondilar: { follow: "dolorCondilar", checks: ["condilarIzq", "condilarDer"] },
          desviacion: { follow: "desviacion", checks: ["desvIzq", "desvDer"] },
        }[key];
        const fg = form.querySelector(`[data-follow="${sideConfig.follow}"] .follow-group`);
        if (fg) fg.classList.remove("input-error");
        sideConfig.checks.forEach((chkName) => {
          form.elements[chkName]?.classList.remove("input-error");
        });
      }
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
      await dialogAlert(`Falta completar: ${missingFields(data).join(", ")}.`);
      const firstMissing = form.elements[missingKeys[0]];
      if (firstMissing) firstMissing.focus();
      return;
    }
    const val = validateFicha(data);
    if (!val.isValid) {
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
      return;
    }
    const ownKey = identityKey || patientKey(currentAllFichas.find((ficha) => ficha.id === data.id) || {});
    const clash = dniNameConflict(data, currentAllFichas, ownKey);
    if (clash) {
      showStep(0);
      form.elements.dni?.classList.add("input-error");
      await dialogAlert(`El documento ${clash.dni || data.dni} ya corresponde a ${clash.nombre}. No se puede guardar con otro nombre.`);
      form.elements.dni?.focus();
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      if (typeof onSave === "function") {
        await onSave(data, identityEdited && identityKey ? { identityKey } : null);
      }
      currentId = data.id;
      showStep(0);
    } catch (error) {
      if (!error.auth) await dialogAlert(error.message);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  if (btnBack) {
    btnBack.addEventListener("click", async () => {
      if (formState() !== formBaseline && !(await dialogConfirm("¿Volver a las fichas sin guardar?"))) {
        return;
      }
      showStep(0);
      if (typeof onBack === "function") onBack();
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener("click", () => showStep(Math.max(0, step - 1)));
  }

  if (btnNext) {
    btnNext.addEventListener("click", async () => {
      const data = readForm();
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
      showStep(Math.min(4, step + 1));
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

  const btnPdfHistory = document.querySelector("#btn-pdf-history");
  if (btnPdfHistory) {
    btnPdfHistory.addEventListener("click", () => {
      const currentItem = readForm();
      const key = patientKey(currentItem);
      const pSessions = currentAllFichas.filter((f) => patientKey(f) === key);
      if (typeof onPrint === "function") {
        onPrint(pSessions.length ? pSessions : [currentItem]);
      }
    });
  }
}
