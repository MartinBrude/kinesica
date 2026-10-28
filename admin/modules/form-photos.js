/**
 * Kinésica Admin - Gestión de Fotografías de la Ficha Clínica
 */

import { dialogAlert, dialogConfirm } from "./dom.js?v=78";
import { api } from "./api.js";
import { compressImage } from "./form-image.js";
import { renderPhotoGallery } from "./form-photos-ui.js";

const fotoInput = document.querySelector("#foto-input");
const fieldFotoUrl = document.querySelector("#field-foto-url");
const fotoDropzone = document.querySelector("#foto-dropzone");
const fotoLoading = document.querySelector("#foto-loading");
const fotoLoadingText = document.querySelector("#foto-loading-text");
const fotoPreviewContainer = document.querySelector("#foto-preview-container");
const fotoPreviewImg = document.querySelector("#foto-preview-img");
const btnFotoSelect = document.querySelector("#btn-foto-select");
const btnFotoChange = document.querySelector("#btn-foto-change");
const btnFotoRemove = document.querySelector("#btn-foto-remove");
const btnFotoRemoveCurrent = document.querySelector("#btn-foto-remove-current");
const btnFotoView = document.querySelector("#btn-foto-view");
const fotoGalleryGrid = document.querySelector("#foto-gallery-grid");
const fotoPreviewStatus = document.querySelector("#foto-preview-status");

let currentFotos = [];
let selectedFotoIdx = 0;
let uploadInFlight = null;

export function getCurrentFotos() {
  return [...currentFotos];
}

export function setCurrentFotos(list) {
  currentFotos = Array.isArray(list) ? list : [];
  selectedFotoIdx = 0;
}

export function getUploadInFlight() {
  return uploadInFlight;
}

function updatePreviewElements(primaryUrl) {
  if (fieldFotoUrl) fieldFotoUrl.value = primaryUrl;
  if (fotoLoading) fotoLoading.hidden = true;
  if (fotoPreviewImg) fotoPreviewImg.src = primaryUrl;
  if (btnFotoView) btnFotoView.href = primaryUrl;
  if (fotoPreviewContainer) fotoPreviewContainer.hidden = false;
  if (fotoDropzone) fotoDropzone.hidden = true;
  if (fotoPreviewStatus) {
    fotoPreviewStatus.textContent = currentFotos.length === 1
      ? "✓ 1 foto adjunta en la sesión"
      : `✓ ${currentFotos.length} fotos adjuntas (viendo ${selectedFotoIdx + 1} de ${currentFotos.length})`;
  }
  if (btnFotoRemoveCurrent) {
    btnFotoRemoveCurrent.hidden = false;
    btnFotoRemoveCurrent.textContent = currentFotos.length > 1
      ? `🗑️ Eliminar foto ${selectedFotoIdx + 1}`
      : "🗑️ Eliminar foto";
  }
}

export function syncFotoPreview(urls) {
  let list = [];
  if (Array.isArray(urls)) {
    list = urls.map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean);
  } else if (typeof urls === "string" && urls.trim()) {
    list = [urls.trim()];
  }
  currentFotos = list;
  if (selectedFotoIdx >= currentFotos.length) {
    selectedFotoIdx = Math.max(0, currentFotos.length - 1);
  }

  const primaryUrl = currentFotos[selectedFotoIdx] || currentFotos[0] || "";
  if (currentFotos.length > 0) {
    updatePreviewElements(primaryUrl);
    renderPhotoGallery({
      photos: currentFotos,
      selectedIdx: selectedFotoIdx,
      onSelect: (idx) => {
        selectedFotoIdx = idx;
        const chosen = currentFotos[idx];
        updatePreviewElements(chosen);
        document.querySelectorAll(".foto-gallery-item").forEach((el, i) => {
          el.classList.toggle("is-selected", i === idx);
        });
      },
      onDelete: (idx) => {
        const updated = currentFotos.filter((_, i) => i !== idx);
        if (selectedFotoIdx >= updated.length) {
          selectedFotoIdx = Math.max(0, updated.length - 1);
        }
        syncFotoPreview(updated);
      },
    });
  } else {
    if (fotoPreviewImg) fotoPreviewImg.src = "";
    if (btnFotoView) btnFotoView.href = "#";
    if (fotoPreviewContainer) fotoPreviewContainer.hidden = true;
    if (fotoGalleryGrid) {
      fotoGalleryGrid.innerHTML = "";
      fotoGalleryGrid.hidden = true;
    }
    if (btnFotoRemoveCurrent) btnFotoRemoveCurrent.hidden = true;
    if (fotoDropzone) fotoDropzone.hidden = false;
  }
}

export async function processAndUploadFotos(files) {
  const fileList = Array.from(files || []).filter(Boolean);
  if (!fileList.length) return;
  if (currentFotos.length + fileList.length > 10) {
    await dialogAlert(`Solo se permiten hasta 10 fotos por sesión. Actualmente tenés ${currentFotos.length} y seleccionaste ${fileList.length}.`);
    return;
  }
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  for (const f of fileList) {
    if (!validTypes.includes(f.type)) {
      await dialogAlert(`El archivo "${f.name}" no tiene un formato admitido. Seleccioná únicamente JPG, PNG o WebP.`);
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      await dialogAlert(`El archivo "${f.name}" supera los 25 MB. Seleccioná imágenes más livianas.`);
      return;
    }
  }

  if (fotoDropzone) fotoDropzone.hidden = true;
  if (fotoPreviewContainer) fotoPreviewContainer.hidden = true;
  if (fotoLoading) fotoLoading.hidden = false;

  const previousFotos = [...currentFotos];
  const uploadedUrls = [];
  try {
    const task = (async () => {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (fotoLoadingText) {
          fotoLoadingText.textContent = fileList.length === 1
            ? "Optimizando y subiendo imagen…"
            : `Optimizando y subiendo imagen ${i + 1} de ${fileList.length}…`;
        }
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.append("foto", compressed);
        const res = await api("foto.php", { method: "POST", body: fd });
        if (res?.url) uploadedUrls.push(res.url);
      }
    })();
    uploadInFlight = task;
    await task;
    if (uploadedUrls.length > 0) {
      selectedFotoIdx = currentFotos.length;
      syncFotoPreview([...currentFotos, ...uploadedUrls]);
    } else {
      syncFotoPreview(previousFotos);
    }
  } catch (err) {
    syncFotoPreview(previousFotos);
    if (!err.auth) await dialogAlert(err.message || "No se pudieron subir una o más imágenes.");
  } finally {
    uploadInFlight = null;
    if (fotoInput) fotoInput.value = "";
  }
}

export function initFormPhotos() {
  fotoInput?.addEventListener("change", (e) => {
    if (e.target.files?.length) processAndUploadFotos(e.target.files);
  });
  btnFotoSelect?.addEventListener("click", (e) => {
    e.stopPropagation();
    fotoInput?.click();
  });
  btnFotoChange?.addEventListener("click", () => fotoInput?.click());

  btnFotoRemoveCurrent?.addEventListener("click", async () => {
    if (!currentFotos.length) return;
    const targetIdx = selectedFotoIdx;
    const confirmed = await dialogConfirm(
      currentFotos.length > 1
        ? `¿Deseás eliminar la foto ${targetIdx + 1} de la sesión?`
        : "¿Deseás quitar la foto adjunta de esta sesión?"
    );
    if (confirmed) {
      const updated = currentFotos.filter((_, i) => i !== targetIdx);
      if (selectedFotoIdx >= updated.length) {
        selectedFotoIdx = Math.max(0, updated.length - 1);
      }
      syncFotoPreview(updated);
    }
  });

  btnFotoRemove?.addEventListener("click", async () => {
    const confirmed = await dialogConfirm(
      currentFotos.length > 1
        ? `¿Deseás quitar todas las fotos (${currentFotos.length}) adjuntas a esta sesión?`
        : "¿Deseás quitar la foto adjunta de esta sesión?"
    );
    if (confirmed) syncFotoPreview([]);
  });

  if (fotoDropzone) {
    fotoDropzone.addEventListener("click", () => fotoInput?.click());
    fotoDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      fotoDropzone.classList.add("dragover");
    });
    fotoDropzone.addEventListener("dragleave", () => fotoDropzone.classList.remove("dragover"));
    fotoDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      fotoDropzone.classList.remove("dragover");
      if (e.dataTransfer?.files?.length) processAndUploadFotos(e.dataTransfer.files);
    });
  }

  fotoPreviewImg?.addEventListener("click", () => {
    if (fieldFotoUrl?.value) window.open(fieldFotoUrl.value, "_blank", "noopener,noreferrer");
  });
}
