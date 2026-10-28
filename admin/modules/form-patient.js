/**
 * Kinésica Admin - Filiación y Selector de Paciente del Formulario
 */

import { patientKey, getUniquePatients } from "../ficha-rules.mjs?v=89";

const form = document.querySelector("#ficha");

let identityKey = "";
let identityEdited = false;

export function getIdentityKey() {
  return identityKey;
}

export function setIdentityKey(key) {
  identityKey = key || "";
}

export function isIdentityEdited() {
  return identityEdited;
}

export function setIdentityEdited(edited) {
  identityEdited = Boolean(edited);
}

export function setDniPower(on, { clear = false } = {}) {
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

export function populatePatientPicker(allFichas = [], selectedKey = "") {
  const select = document.querySelector("#patient-quick-select");
  const card = document.querySelector("#patient-picker-card");
  if (!select) return;
  const patients = getUniquePatients(allFichas);
  if (card) card.hidden = patients.length === 0;
  select.innerHTML = '<option value="">— Cargar nuevo paciente (o seleccionar existente) —</option>';
  for (const p of patients) {
    const opt = document.createElement("option");
    opt.value = p.key;
    opt.textContent = `${p.nombre} (DNI ${p.dni || "—"}) · ${p.sessions.length} ses.`;
    select.append(opt);
  }
  select.value = selectedKey || "";
}

export function clearPatientInputs() {
  if (!form) return;
  setPatientLocked(false);
  setDniPower(true);
  form.elements.nombre.value = "";
  form.elements.dni.value = "";
  form.elements.nacimiento.value = "";
  form.elements.lugarNac.value = "";
  form.elements.edad.value = "";
  document.querySelectorAll('[data-single="motivo"] button').forEach((b) => b.classList.remove("on"));
  if (form.elements.habitoApretamiento) form.elements.habitoApretamiento.checked = false;
  if (form.elements.habitoBruxismo) form.elements.habitoBruxismo.checked = false;
  if (form.elements.habitoMasticacionUni) form.elements.habitoMasticacionUni.checked = false;
  if (form.elements.habitoOnicofagia) form.elements.habitoOnicofagia.checked = false;
  if (form.elements.antecedentes) form.elements.antecedentes.value = "";
}

export function applyPatientData(match, pSessionsCount = 1) {
  if (!form || !match) return;
  form.elements.nombre.value = match.nombre || "";
  form.elements.dni.value = match.dni || "";
  form.elements.nacimiento.value = match.nacimiento || "";
  form.elements.lugarNac.value = match.lugarNac || "";

  if (match.motivo) {
    document.querySelectorAll('[data-single="motivo"] button').forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.value === match.motivo);
    });
  }
  if (form.elements.habitoApretamiento) form.elements.habitoApretamiento.checked = Boolean(match.habitoApretamiento);
  if (form.elements.habitoBruxismo) form.elements.habitoBruxismo.checked = Boolean(match.habitoBruxismo);
  if (form.elements.habitoMasticacionUni) form.elements.habitoMasticacionUni.checked = Boolean(match.habitoMasticacionUni);
  if (form.elements.habitoOnicofagia) form.elements.habitoOnicofagia.checked = Boolean(match.habitoOnicofagia);
  if (match.antecedentes) form.elements.antecedentes.value = match.antecedentes;
  if (form.elements.profesional && match.profesional) {
    form.elements.profesional.value = match.profesional;
  }
  setDniPower(!match.sinDocumento, { clear: Boolean(match.sinDocumento) });
  setPatientLocked(true, match, pSessionsCount, false);
}

export function setupPatientHandlers({
  getCurrentAllFichas,
  onSyncAge,
  onValidationChange,
  onSelectPatientMotivo,
}) {
  const patientSelect = document.querySelector("#patient-quick-select");
  if (patientSelect) {
    patientSelect.addEventListener("change", () => {
      const selectedKey = patientSelect.value;
      if (!selectedKey) {
        clearPatientInputs();
        if (typeof onSelectPatientMotivo === "function") onSelectPatientMotivo("");
        form.elements.nombre?.focus();
        if (typeof onValidationChange === "function") onValidationChange();
        return;
      }
      const all = (typeof getCurrentAllFichas === "function" ? getCurrentAllFichas() : []) || [];
      const match = all.find((f) => patientKey(f) === selectedKey);
      if (match) {
        const pSessions = all.filter((f) => patientKey(f) === selectedKey);
        applyPatientData(match, pSessions.length);
        if (match.motivo && typeof onSelectPatientMotivo === "function") {
          onSelectPatientMotivo(match.motivo);
        }
        if (typeof onSyncAge === "function") onSyncAge();
        if (typeof onValidationChange === "function") onValidationChange();
        form.elements.fechaSesion?.focus();
      }
    });
  }

  const dniPowerBtn = document.querySelector("#btn-dni-power");
  dniPowerBtn?.addEventListener("click", () => {
    if (dniPowerBtn.disabled) return;
    const on = dniPowerBtn.classList.contains("is-on");
    setDniPower(!on, { clear: on });
    if (typeof onValidationChange === "function") onValidationChange();
  });

  const editBtn = document.querySelector("#btn-edit-primary");
  editBtn?.addEventListener("click", () => {
    setPatientLocked(false, null, 0, false, true);
    form?.elements.nombre?.focus();
  });

  const newToggleBtn = document.querySelector("#btn-patient-new-toggle");
  newToggleBtn?.addEventListener("click", () => {
    if (patientSelect) patientSelect.value = "";
    clearPatientInputs();
    if (typeof onSelectPatientMotivo === "function") onSelectPatientMotivo("");
    form?.elements.nombre?.focus();
    if (typeof onValidationChange === "function") onValidationChange();
  });
}
