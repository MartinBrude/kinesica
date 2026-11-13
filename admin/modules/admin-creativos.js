/**
 * Kinésica Admin — Galería de Creativos Instagram (orquestador).
 */

import {
  loadCola,
  toggleCola,
  resolveCaption,
  resolveImageText,
  subscribeCola,
  hideCreativo,
  unhideCreativo,
} from "./admin-creativos-cola.js?v=12";
import { ensureColaUiPaint } from "./admin-creativos-cola-ui.js?v=4";
import { initListaUI } from "./admin-creativos-lista.js?v=12";
import { bindImageTextUi } from "./admin-creativos-image-text.js?v=5";
import { CREATIVOS_DATA } from "./admin-creativos-data.js?v=1";
import {
  setActiveFormat,
  setActiveFilter,
  setSearchQuery,
  getSelectedItem,
} from "./admin-creativos-state.js?v=1";
import { renderCreativosGrid } from "./admin-creativos-grid.js?v=1";
import {
  openLightboxModal,
  closeLightboxModal,
  initModalCaptionControls,
  setModalCaptionEditMode,
} from "./admin-creativos-modal.js?v=1";

export { CREATIVOS_DATA };

export function initCreativosUI() {
  const container = document.getElementById("admin-creativos-card");
  if (!container) return;

  const btnFeed = document.getElementById("btn-creativos-format-feed");
  const btnStory = document.getElementById("btn-creativos-format-story");

  if (btnFeed && btnStory) {
    btnFeed.addEventListener("click", () => {
      setActiveFormat("feed");
      btnFeed.classList.add("is-active");
      btnStory.classList.remove("is-active");
      renderCreativosGrid();
    });
    btnStory.addEventListener("click", () => {
      setActiveFormat("story");
      btnStory.classList.add("is-active");
      btnFeed.classList.remove("is-active");
      renderCreativosGrid();
    });
  }

  const filterBtns = container.querySelectorAll(".creativos-filter-pill");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      setActiveFilter(btn.dataset.filter || "todos");
      renderCreativosGrid();
    });
  });

  const searchInput = document.getElementById("admin-creativos-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      setSearchQuery(String(e.target.value || "").toLowerCase().trim());
      renderCreativosGrid();
    });
  }

  const resolver = (id) => {
    const base = CREATIVOS_DATA.find((it) => it.id === id);
    if (!base) return null;
    const copy = resolveCaption(id, base);
    const img = resolveImageText(id, base);
    return { ...base, copy, cat: img.cat, title: img.title, body: img.body };
  };

  const gridEl = document.getElementById("admin-creativos-grid");
  if (gridEl) {
    gridEl.addEventListener("click", async (e) => {
      if (e.target.closest(".btn-creativo-heart, .btn-creativo-cola, .creativo-badge-cola")) {
        return;
      }

      const trashBtn = e.target.closest(".btn-creativo-trash");
      if (trashBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = trashBtn.dataset.trashId;
        if (!id) return;
        const restore = trashBtn.classList.contains("is-restore");
        const item = CREATIVOS_DATA.find((it) => it.id === id);
        const label = item?.title || id;
        const ok = window.confirm(
          restore
            ? `¿Restaurar "${label}" al catálogo?`
            : `¿Eliminar "${label}" del catálogo?\n\nVa a la papelera (se puede restaurar). Si estaba en la cola, se saca.`
        );
        if (!ok) return;
        trashBtn.disabled = true;
        try {
          if (restore) await unhideCreativo(id);
          else await hideCreativo(id);
        } catch (err) {
          if (!err.auth) window.alert(err.message || "No se pudo actualizar la papelera");
        } finally {
          trashBtn.disabled = false;
        }
        return;
      }

      const copyBtn = e.target.closest(".btn-creativo-copy");
      if (copyBtn) {
        const id = copyBtn.dataset.id;
        const item = CREATIVOS_DATA.find((it) => it.id === id);
        const text = item ? resolveCaption(id, item) : "";
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = "✓ ¡Copiado!";
            copyBtn.classList.add("btn-copied");
            setTimeout(() => {
              copyBtn.textContent = originalText;
              copyBtn.classList.remove("btn-copied");
            }, 2200);
          });
        }
        return;
      }

      if (e.target.closest(".btn-creativo-trash")) return;
      const zoomTrigger = e.target.closest(".creativo-thumb-box");
      if (zoomTrigger) {
        const id = zoomTrigger.dataset.id;
        const item = CREATIVOS_DATA.find((it) => it.id === id);
        if (item) openLightboxModal(item);
      }
    });
  }

  ensureColaUiPaint();
  initListaUI(resolver);
  bindImageTextUi(container, {
    resolveItem: resolver,
    onDone: () => {
      renderCreativosGrid();
      const selected = getSelectedItem();
      if (selected) openLightboxModal(resolver(selected.id) || selected);
    },
  });
  subscribeCola(() => renderCreativosGrid());
  loadCola();

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-creativo-cola, .btn-creativo-heart");
    if (btn && btn.dataset.colaId) {
      e.stopPropagation();
      e.preventDefault();
      toggleCola(btn.dataset.colaId, resolver);
    }
  });

  initModalCaptionControls();
  const modalClose = document.getElementById("creativo-modal-close");
  const modalBackdrop = document.getElementById("creativo-modal-backdrop");
  if (modalClose) modalClose.addEventListener("click", closeLightboxModal);
  if (modalBackdrop) modalBackdrop.addEventListener("click", closeLightboxModal);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const modal = document.getElementById("creativo-lightbox-modal");
    if (!modal || modal.hidden) return;
    const editor = document.getElementById("creativo-modal-caption-editor");
    if (editor && !editor.hidden) {
      const copy = document.getElementById("creativo-modal-copy");
      const textarea = document.getElementById("creativo-modal-caption-textarea");
      if (textarea && copy) textarea.value = copy.textContent || "";
      setModalCaptionEditMode(false);
      return;
    }
    closeLightboxModal();
  });
}

export function loadCreativosData() {
  renderCreativosGrid();
}
