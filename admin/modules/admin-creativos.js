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
import { bindImageTextUi } from "./admin-creativos-image-text.js?v=7";
import { CREATIVOS_DATA } from "./admin-creativos-data.js?v=2";
import {
  setActiveFormat,
  setActiveFilter,
  setSearchQuery,
  getSelectedItem,
} from "./admin-creativos-state.js?v=1";
import { renderCreativosGrid } from "./admin-creativos-grid.js?v=4";
import {
  openLightboxModal,
  closeLightboxModal,
  initModalCaptionControls,
  setModalCaptionEditMode,
} from "./admin-creativos-modal.js?v=4";

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
    gridEl.addEventListener("click", (e) => {
      if (e.target.closest(".btn-creativo-heart, .btn-creativo-cola, .creativo-badge-cola, .btn-creativo-trash")) {
        return;
      }
      const card = e.target.closest(".creativo-card");
      if (card && card.dataset.id) {
        const item = CREATIVOS_DATA.find((it) => it.id === card.dataset.id);
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

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-creativo-cola, .btn-creativo-heart");
    if (btn && btn.dataset.colaId) {
      e.stopPropagation();
      e.preventDefault();
      await toggleCola(btn.dataset.colaId, resolver);
      return;
    }

    const trashBtn = e.target.closest(".btn-creativo-trash");
    if (trashBtn && trashBtn.dataset.trashId) {
      e.preventDefault();
      e.stopPropagation();
      const id = trashBtn.dataset.trashId;
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
        renderCreativosGrid();
        closeLightboxModal();
      } catch (err) {
        if (!err.auth) window.alert(err.message || "No se pudo actualizar la papelera");
      } finally {
        trashBtn.disabled = false;
      }
      return;
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
