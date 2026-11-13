import { form } from "./form-patient-state.js";
import { setDniPower, setPatientLocked } from "./form-patient-lock.js";

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
