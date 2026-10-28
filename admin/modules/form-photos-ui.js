/**
 * Kinésica Admin - UI de Galería de Fotos del Formulario
 */

import { dialogConfirm } from "./dom.js?v=78";

export function renderPhotoGallery({
  photos,
  selectedIdx,
  onSelect,
  onDelete,
}) {
  const fotoGalleryGrid = document.querySelector("#foto-gallery-grid");
  if (!fotoGalleryGrid) return;

  fotoGalleryGrid.innerHTML = "";
  photos.forEach((fUrl, idx) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = `foto-gallery-item ${idx === selectedIdx ? "is-selected" : ""}`;
    itemDiv.title = `Foto ${idx + 1} de ${photos.length} (hacé clic para verla en grande)`;

    const thumb = document.createElement("img");
    thumb.className = "foto-gallery-thumb";
    thumb.src = fUrl;
    thumb.alt = `Miniatura foto ${idx + 1}`;

    const badge = document.createElement("span");
    badge.className = "foto-gallery-badge";
    badge.textContent = `${idx + 1}/${photos.length}`;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "foto-gallery-delete";
    delBtn.title = `Eliminar foto ${idx + 1}`;
    delBtn.setAttribute("aria-label", `Eliminar foto ${idx + 1}`);
    delBtn.innerHTML = "×";
    delBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const ok = await dialogConfirm(`¿Deseás quitar la foto ${idx + 1} de la sesión?`);
      if (ok && typeof onDelete === "function") {
        onDelete(idx);
      }
    });

    itemDiv.appendChild(thumb);
    itemDiv.appendChild(badge);
    itemDiv.appendChild(delBtn);

    itemDiv.addEventListener("click", () => {
      if (typeof onSelect === "function") {
        onSelect(idx);
      }
    });

    fotoGalleryGrid.appendChild(itemDiv);
  });
  fotoGalleryGrid.hidden = false;
}
