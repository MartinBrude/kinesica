import { form } from "./form-patient-state.js";
import { setDniPower, setPatientLocked } from "./form-patient-lock.js";
import { singles } from "./form-runtime.js?v=5";
import { applySingleSelection } from "./form-singles.js?v=2";

export function clearPatientInputs() {
  if (!form) return;
  setPatientLocked(false);
  setDniPower(true);
  form.elements.nombre.value = "";
  form.elements.dni.value = "";
  form.elements.nacimiento.value = "";
  form.elements.lugarNac.value = "";
  form.elements.edad.value = "";
  const motivoGroup = form.querySelector('[data-single="motivo"]');
  applySingleSelection(motivoGroup, "", singles);
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

  const motivoGroup = form.querySelector('[data-single="motivo"]');
  applySingleSelection(motivoGroup, match.motivo || "", singles);
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
