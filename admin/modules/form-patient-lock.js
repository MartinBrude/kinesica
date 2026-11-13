import { patientKey, capitalizePersonName } from "../ficha-rules.mjs?v=89";
import { form, setIdentityKey, setIdentityEdited } from "./form-patient-state.js";

export function setDniPower(on, { clear = false } = {}) {
  const btn = document.querySelector("#btn-dni-power");
  const input = form?.elements.dni;
  const locked = document.querySelector("#patient-fixed-section")?.classList.contains("is-locked");
  if (btn) {
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.title = on
      ? "Documento opcional. Tocá para no pedirlo."
      : "Sin documento. Tocá para volver a cargarlo.";
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
  input.required = false;
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
    setIdentityKey(patientKey(patientData || {}));
    setIdentityEdited(false);
    if (fixedSection) fixedSection.classList.add("is-locked");
    inputs.forEach((input) => (input.readOnly = true));
    habitChecks.forEach((chk) => (chk.disabled = true));
    document.querySelectorAll('[data-single="motivo"] button').forEach((btn) => (btn.disabled = true));
    if (banner) banner.hidden = false;
    if (newToggle) newToggle.hidden = false;
    if (nameSpan) nameSpan.textContent = capitalizePersonName(patientData?.nombre || form?.elements.nombre?.value || "");
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
    if (keepValues) setIdentityEdited(true);
    else {
      setIdentityKey("");
      setIdentityEdited(false);
    }
  }
  const powerBtn = document.querySelector("#btn-dni-power");
  if (powerBtn) powerBtn.disabled = locked;
  setDniPower(powerBtn ? powerBtn.classList.contains("is-on") : true);
}
