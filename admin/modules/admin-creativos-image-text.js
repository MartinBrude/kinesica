/**
 * Edición on-image en modal (cat/title/body) + regeneración PNG.
 * Éxito: toast + flash en miniatura (sin alert).
 */

import { escapeHtml, toast } from "./dom.js?v=79";
import { getSessionUser } from "./auth.js?v=83";
import {
  resolveImageText,
  saveImageText,
  assetVersion,
  IMG_CAT_MAX,
  IMG_TITLE_MAX,
  IMG_BODY_MAX,
} from "./admin-creativos-cola.js?v=10";

let resolveSeed = () => null;
let onSavedCb = null;
let editingId = null;

export function canEditImageText() {
  return Boolean(getSessionUser());
}

export function imageTextEditButtonHtml(id) {
  if (!canEditImageText()) return "";
  return `<button type="button" class="btn light btn-sm btn-queue-edit-imgtext" data-id="${escapeHtml(id)}" title="Editar textos de la imagen">🖼️ Editar imagen</button>`;
}

function modalEls() {
  return {
    root: document.getElementById("creativo-imgtext-modal"),
    backdrop: document.getElementById("creativo-imgtext-backdrop"),
    close: document.getElementById("creativo-imgtext-close"),
    cancel: document.getElementById("creativo-imgtext-cancel"),
    save: document.getElementById("creativo-imgtext-save"),
    cat: document.getElementById("creativo-imgtext-cat"),
    title: document.getElementById("creativo-imgtext-title"),
    body: document.getElementById("creativo-imgtext-body"),
    preview: document.getElementById("creativo-imgtext-preview"),
    heading: document.getElementById("creativo-imgtext-heading"),
  };
}

function refreshCharCounts() {
  const { root } = modalEls();
  if (!root) return;
  root.querySelectorAll("[data-field]").forEach((el) => {
    const max = Number(el.getAttribute("maxlength") || 0);
    const span = root.querySelector(`[data-count-for="${CSS.escape(el.id)}"]`);
    if (span) span.textContent = `${String(el.value || "").length}/${max}`;
  });
}

function flashPieceThumbs(id) {
  document.querySelectorAll(
    `.creativo-card[data-id="${CSS.escape(id)}"] .creativo-thumb-box, .creativos-queue-item[data-id="${CSS.escape(id)}"] .creativos-queue-thumb`
  ).forEach((el) => {
    el.classList.remove("is-regen-flash");
    // reflow para reiniciar animación
    void el.offsetWidth;
    el.classList.add("is-regen-flash");
    window.setTimeout(() => el.classList.remove("is-regen-flash"), 900);
  });
}

export function closeImageTextModal() {
  const { root } = modalEls();
  if (root) root.hidden = true;
  editingId = null;
  if (!document.getElementById("creativo-lightbox-modal")?.hidden) return;
  document.body.style.overflow = "";
}

export function openImageTextModal(id, seedItem) {
  if (!canEditImageText()) {
    toast("Tenés que iniciar sesión para editar estos textos.", { type: "info" });
    return;
  }
  const els = modalEls();
  if (!els.root) return;
  const seed = seedItem || resolveSeed(id) || {};
  const t = resolveImageText(id, seed);
  editingId = id;
  if (els.heading) els.heading.textContent = t.title || id;
  if (els.cat) els.cat.value = t.cat;
  if (els.title) els.title.value = t.title;
  if (els.body) els.body.value = t.body;
  if (els.preview && seed.feedUrl) {
    els.preview.src = `${seed.feedUrl}?v=${assetVersion}`;
    els.preview.alt = t.title || "Vista previa";
  }
  refreshCharCounts();
  els.root.hidden = false;
  document.body.style.overflow = "hidden";
  els.cat?.focus();
}

async function saveFromModal(btn) {
  if (!editingId) return;
  const els = modalEls();
  const fields = {
    cat: String(els.cat?.value || "").trim(),
    title: String(els.title?.value || "").trim(),
    body: String(els.body?.value || "").trim(),
  };
  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "Regenerando…";
  els.root?.classList.add("is-saving");
  try {
    const data = await saveImageText(editingId, fields);
    const seed = resolveSeed(editingId) || {};
    if (els.preview && seed.feedUrl) {
      els.preview.src = `${seed.feedUrl}?v=${assetVersion}`;
    }
    const warn = Array.isArray(data?.warnings) && data.warnings.length
      ? ` · ${data.warnings.join(", ")}`
      : "";
    toast(`Imagen regenerada${warn}`, { type: "success", duration: 2600 });
    flashPieceThumbs(editingId);
    const id = editingId;
    closeImageTextModal();
    if (typeof onSavedCb === "function") onSavedCb(id, fields, data);
  } catch (err) {
    if (!err.auth) toast(err.message || "No se pudo guardar / regenerar", { type: "danger" });
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
    els.root?.classList.remove("is-saving");
  }
}

/** @param {HTMLElement} container @param {{resolveItem?: Function, onDone?: Function}} [opts] */
export function bindImageTextUi(container, opts = {}) {
  if (typeof opts === "function") opts = { onDone: opts };
  if (opts.resolveItem) resolveSeed = opts.resolveItem;
  if (opts.onDone) onSavedCb = opts.onDone;
  if (!container || container.dataset.imgtextBound === "1") return;
  container.dataset.imgtextBound = "1";

  const els = modalEls();
  els.root?.addEventListener("input", (e) => {
    if (e.target.closest("[data-field]")) refreshCharCounts();
  });
  els.close?.addEventListener("click", closeImageTextModal);
  els.backdrop?.addEventListener("click", closeImageTextModal);
  els.cancel?.addEventListener("click", closeImageTextModal);
  els.save?.addEventListener("click", () => saveFromModal(els.save));

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (els.root && !els.root.hidden) {
      e.stopPropagation();
      closeImageTextModal();
    }
  });

  container.addEventListener("click", (e) => {
    const edit = e.target.closest(".btn-queue-edit-imgtext");
    if (!edit) return;
    e.preventDefault();
    e.stopPropagation();
    openImageTextModal(edit.dataset.id, resolveSeed(edit.dataset.id));
  });
}
