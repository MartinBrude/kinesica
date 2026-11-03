/**
 * Kinésica Admin - Modal de Reporte de Errores
 */

import { api } from "./api.js?v=77";
import { dialogAlert } from "./dom.js?v=78";
import { renderSeccionesOptions } from "./admin-errores-config.js";

const modalEl = document.querySelector("#admin-error-modal");
const formEl = document.querySelector("#admin-error-form");
const selectSeccion = document.querySelector("#admin-error-seccion");
const inputInfo = document.querySelector("#admin-error-info");
const inputActual = document.querySelector("#admin-error-actual");
const inputEsperado = document.querySelector("#admin-error-esperado");
const inputFotoFile = document.querySelector("#admin-error-foto-file");
const inputFotoUrl = document.querySelector("#admin-error-foto-url");
const fotoPreview = document.querySelector("#admin-error-foto-preview");
const inputVideoFile = document.querySelector("#admin-error-video-file");
const inputVideoUrl = document.querySelector("#admin-error-video-url");
const videoPreview = document.querySelector("#admin-error-video-preview");
const uploadStatus = document.querySelector("#admin-error-upload-status");
const btnClose = document.querySelector("#admin-error-modal-close");
const btnCancel = document.querySelector("#admin-error-modal-cancel");
const btnSave = document.querySelector("#admin-error-modal-save");

let selectedFotoFile = null;
let selectedVideoFile = null;

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
  selectedFotoFile = null;
  selectedVideoFile = null;
  if (fotoPreview) { fotoPreview.hidden = true; fotoPreview.src = ""; }
  if (videoPreview) { videoPreview.hidden = true; videoPreview.src = ""; }
  if (uploadStatus) uploadStatus.textContent = "Podés elegir un archivo de video desde tu compu o ingresar un enlace.";
  modalEl.hidden = false;
  setTimeout(() => inputInfo?.focus(), 50);
}

export function closeErrorModal() {
  if (modalEl) modalEl.hidden = true;
}

async function uploadFileIfNeeded(file, endpoint, paramName) {
  if (!file) return null;
  const fd = new FormData();
  fd.append(paramName, file);
  const res = await api(endpoint, { method: "POST", body: fd });
  return res?.url || "";
}

export async function getErrorFormPayload() {
  const seccion = selectSeccion?.value?.trim() || "";
  const info = inputInfo?.value?.trim() || "";
  const actual = inputActual?.value?.trim() || "";
  const esperado = inputEsperado?.value?.trim() || "";

  if (!seccion || !info || !actual || !esperado) {
    dialogAlert("Por favor completá la sección, la información y los comportamientos actual y esperado.");
    return null;
  }

  let foto = inputFotoUrl?.value?.trim() || "";
  let video = inputVideoUrl?.value?.trim() || "";

  if (selectedFotoFile) {
    if (uploadStatus) uploadStatus.textContent = "Subiendo imagen desde la compu...";
    try {
      const serverUrl = await uploadFileIfNeeded(selectedFotoFile, "foto.php", "foto");
      if (serverUrl) foto = serverUrl;
    } catch (e) {
      dialogAlert("No se pudo subir la foto: " + (e.message || "Error al subir"));
      return null;
    }
  }

  if (selectedVideoFile) {
    if (uploadStatus) uploadStatus.textContent = "Subiendo video desde la compu (puede demorar unos segundos)...";
    try {
      const serverUrl = await uploadFileIfNeeded(selectedVideoFile, "video.php", "video");
      if (serverUrl) video = serverUrl;
    } catch (e) {
      dialogAlert("No se pudo subir el video: " + (e.message || "Error al subir"));
      return null;
    }
  }

  return { seccion, info, comportamiento_actual: actual, comportamiento_esperado: esperado, foto, video };
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

  inputFotoFile?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      dialogAlert("La imagen no debe superar los 15 MB.");
      inputFotoFile.value = "";
      return;
    }
    selectedFotoFile = file;
    if (fotoPreview) {
      fotoPreview.src = URL.createObjectURL(file);
      fotoPreview.hidden = false;
    }
  });

  inputVideoFile?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      dialogAlert("El video no debe superar los 100 MB.");
      inputVideoFile.value = "";
      return;
    }
    selectedVideoFile = file;
    if (videoPreview) {
      videoPreview.src = URL.createObjectURL(file);
      videoPreview.hidden = false;
    }
    if (uploadStatus) uploadStatus.textContent = `Archivo seleccionado: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
  });

  formEl?.addEventListener("submit", onSaveSubmit);
}
