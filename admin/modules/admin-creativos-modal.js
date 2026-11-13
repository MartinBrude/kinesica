/**
 * Kinésica Admin — Lightbox / caption de creativos Instagram.
 */

import { escapeHtml } from "./dom.js?v=79";
import {
  getPublicationDetails,
  resolveCaption,
  resolveImageText,
  CAPTION_MAX,
  saveCaption,
  assetVersion,
} from "./admin-creativos-cola.js?v=12";
import { colaButtonHtml } from "./admin-creativos-cola-ui.js?v=4";
import { canEditCaptions } from "./admin-creativos-caption.js?v=10";
import {
  imageTextEditButtonHtml,
  canEditImageText,
} from "./admin-creativos-image-text.js?v=5";
import {
  getActiveFormat,
  getSelectedItem,
  setSelectedItem,
} from "./admin-creativos-state.js?v=1";

function getModalCaptionEls() {
  return {
    copy: document.getElementById("creativo-modal-copy"),
    editor: document.getElementById("creativo-modal-caption-editor"),
    textarea: document.getElementById("creativo-modal-caption-textarea"),
    btnEdit: document.getElementById("creativo-modal-btn-edit"),
    btnCopy: document.getElementById("creativo-modal-btn-copy"),
    btnSave: document.getElementById("creativo-modal-btn-save-caption"),
    btnCancel: document.getElementById("creativo-modal-btn-cancel-caption"),
  };
}

export function setModalCaptionEditMode(editing) {
  const els = getModalCaptionEls();
  if (els.copy) els.copy.hidden = editing;
  if (els.editor) els.editor.hidden = !editing;
  if (els.btnEdit) els.btnEdit.hidden = editing || !canEditCaptions();
  if (els.btnCopy) els.btnCopy.hidden = editing;
}

function getModalCaptionText() {
  const els = getModalCaptionEls();
  if (els.editor && !els.editor.hidden && els.textarea) {
    return String(els.textarea.value || "");
  }
  return String(els.copy?.textContent || "");
}

export function openLightboxModal(item) {
  setSelectedItem(item);
  const modal = document.getElementById("creativo-lightbox-modal");
  if (!modal) return;

  const modalImg = document.getElementById("creativo-modal-img");
  const modalTitle = document.getElementById("creativo-modal-title");
  const modalCat = document.getElementById("creativo-modal-cat");
  const modalId = document.getElementById("creativo-modal-id");
  const modalBtnFeed = document.getElementById("creativo-modal-dl-feed");
  const modalBtnStory = document.getElementById("creativo-modal-dl-story");
  const els = getModalCaptionEls();
  const activeFormat = getActiveFormat();

  const currentImg = activeFormat === "story" ? item.storyUrl : item.feedUrl;
  const caption = resolveCaption(item.id, item) || item.copy || item.body || "";
  const texts = resolveImageText(item.id, item);

  if (modalImg) modalImg.src = `${currentImg}?v=${assetVersion}`;
  if (modalTitle) modalTitle.textContent = texts.title;
  if (modalCat) modalCat.textContent = texts.cat;
  if (modalId) {
    modalId.textContent = item.id || "—";
    modalId.title = item.id ? `ID: ${item.id}` : "Sin ID";
  }
  if (els.copy) els.copy.textContent = caption;
  if (els.textarea) {
    els.textarea.value = caption;
    els.textarea.maxLength = CAPTION_MAX;
  }
  setModalCaptionEditMode(false);

  const imgSlot = document.getElementById("creativo-modal-imgtext-slot");
  if (imgSlot) {
    imgSlot.innerHTML = canEditImageText() ? imageTextEditButtonHtml(item.id) : "";
  }

  if (modalBtnFeed) {
    modalBtnFeed.href = `${item.feedUrl}?v=${assetVersion}`;
    modalBtnFeed.download = `kinesica_feed_${item.id}.png`;
  }
  if (modalBtnStory) {
    modalBtnStory.href = `${item.storyUrl}?v=${assetVersion}`;
    modalBtnStory.download = `kinesica_story_${item.id}.png`;
  }

  const slot = document.getElementById("creativo-modal-cola-slot");
  if (slot) {
    const pub = getPublicationDetails(item.id);
    if (pub) {
      slot.innerHTML = `
        <div class="creativo-modal-pub-banner is-published">
          <div class="pub-banner-title">✅ Publicada en Instagram</div>
          <div class="pub-banner-sub">Fecha: <strong>${pub.date}</strong> · Canales: <strong>${pub.channelText}</strong></div>
          ${pub.error ? `<div class="pub-banner-err">⚠️ ${escapeHtml(pub.error)}</div>` : ""}
          <div class="pub-banner-actions">
            ${colaButtonHtml(item)}
          </div>
        </div>`;
    } else {
      slot.innerHTML = colaButtonHtml(item);
    }
  }
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

export function closeLightboxModal() {
  const modal = document.getElementById("creativo-lightbox-modal");
  if (modal) modal.hidden = true;
  setModalCaptionEditMode(false);
  setSelectedItem(null);
  document.body.style.overflow = "";
}

export function initModalCaptionControls() {
  const modal = document.getElementById("creativo-lightbox-modal");
  if (!modal || modal.dataset.captionControlsBound === "1") return;
  modal.dataset.captionControlsBound = "1";

  modal.addEventListener("click", async (e) => {
    const els = getModalCaptionEls();
    const selectedItem = getSelectedItem();
    if (e.target.closest("#creativo-modal-btn-edit")) {
      if (!canEditCaptions() || !selectedItem) return;
      if (els.textarea) els.textarea.value = getModalCaptionText();
      setModalCaptionEditMode(true);
      els.textarea?.focus();
      return;
    }
    if (e.target.closest("#creativo-modal-btn-cancel-caption")) {
      if (els.textarea && els.copy) els.textarea.value = els.copy.textContent || "";
      setModalCaptionEditMode(false);
      return;
    }
    if (e.target.closest("#creativo-modal-btn-save-caption")) {
      if (!canEditCaptions() || !selectedItem || !els.textarea) return;
      const caption = String(els.textarea.value || "").trim();
      if (!caption || caption.length > CAPTION_MAX) {
        window.alert(`El texto debe tener entre 1 y ${CAPTION_MAX} caracteres (límite de Instagram).`);
        return;
      }
      const btn = els.btnSave;
      if (btn) btn.disabled = true;
      try {
        await saveCaption(selectedItem.id, caption);
        if (els.copy) els.copy.textContent = caption;
        setModalCaptionEditMode(false);
        window.alert("Texto guardado. Vale para la cola y para la próxima vez que encoles esta pieza.");
      } catch (err) {
        if (!err.auth) window.alert(err.message || "No se pudo guardar el texto");
      } finally {
        if (btn) btn.disabled = false;
      }
      return;
    }
    if (e.target.closest("#creativo-modal-btn-copy")) {
      const text = getModalCaptionText();
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        const copyBtn = els.btnCopy;
        if (!copyBtn) return;
        const orig = copyBtn.textContent;
        copyBtn.textContent = "✓ ¡Texto copiado!";
        setTimeout(() => {
          copyBtn.textContent = orig;
        }, 2200);
      });
    }
  });
}
