/**
 * Kinésica Admin - Modal de Reporte de Errores
 */

import { escapeHtml, dialogAlert } from "./dom.js?v=78";
import { renderSeccionesOptions } from "./admin-errores-config.js";

const modalEl = document.querySelector("#admin-error-modal");
const formEl = document.querySelector("#admin-error-form");
const selectSeccion = document.querySelector("#admin-error-seccion");
const inputInfo = document.querySelector("#admin-error-info");
const inputActual = document.querySelector("#admin-error-actual");
const inputEsperado = document.querySelector("#admin-error-esperado");
const inputFoto = document.querySelector("#admin-error-foto-file");
const inputFotoUrl = document.querySelector("#admin-error-foto-url");
const fotoPreview = document.querySelector("#admin-error-foto-preview");
const inputVideo = document.querySelector("#admin-error-video");
const btnClose = document.querySelector("#admin-error-modal-close");
const btnCancel = document.querySelector("#admin-error-modal-cancel");
const btnSave = document.querySelector("#admin-error-modal-save");

let uploadedFotoUrl = "";

export function isErrorModalOpen() {
  return modalEl && !modalEl.hidden;
}

export function openErrorModal() {
  if (!modalEl) return;
  if (selectSeccion && !selectSeccion.dataset.filled) {
    selectSeccion.innerHTML = `<option value="" disabled selected>Seleccioná la sección afectada...</option>${renderSeccionesOptions()}`;
    selectSeccion.dataset.filled = "1";
  }
  formEl?.reset();
  uploadedFotoUrl = "";
  if (inputFotoUrl) inputFotoUrl.value = "";
  if (fotoPreview) {
    fotoPreview.hidden = true;
    fotoPreview.src = "";
  }
  modalEl.hidden = false;
  setTimeout(() => inputInfo?.focus(), 50);
}

export function closeErrorModal() {
  if (modalEl) modalEl.hidden = true;
}

export function getErrorFormPayload() {
  const seccion = selectSeccion?.value?.trim() || "";
  const info = inputInfo?.value?.trim() || "";
  const actual = inputActual?.value?.trim() || "";
  const esperado = inputEsperado?.value?.trim() || "";
  const foto = inputFotoUrl?.value?.trim() || uploadedFotoUrl || "";
  const video = inputVideo?.value?.trim() || "";

  if (!seccion || !info || !actual || !esperado) {
    return null;
  }

  return {
    seccion,
    info,
    comportamiento_actual: actual,
    comportamiento_esperado: esperado,
    foto,
    video,
  };
}

export function setErrorSaveButtonDisabled(disabled) {
  if (btnSave) {
    btnSave.disabled = disabled;
    btnSave.textContent = disabled ? "Guardando..." : "Guardar Reporte";
  }
}

export function bindErrorModalEvents({ onSaveSubmit }) {
  btnClose?.addEventListener("click", closeErrorModal);
  btnCancel?.addEventListener("click", closeErrorModal);
  modalEl?.addEventListener("click", (e) => {
    if (e.target === modalEl) closeErrorModal();
  });

  inputFoto?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      dialogAlert("La imagen no debe superar los 8 MB.");
      inputFoto.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      uploadedFotoUrl = evt.target?.result || "";
      if (fotoPreview) {
        fotoPreview.src = uploadedFotoUrl;
        fotoPreview.hidden = false;
      }
    };
    reader.readAsDataURL(file);
  });

  formEl?.addEventListener("submit", onSaveSubmit);
}
