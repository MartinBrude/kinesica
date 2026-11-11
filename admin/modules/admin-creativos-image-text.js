/**
 * Edición de textos on-image (cat/title/body) + regeneración PNG.
 */

import { escapeHtml } from "./dom.js?v=79";
import { getSessionUser } from "./auth.js?v=83";
import {
  resolveImageText,
  saveImageText,
  IMG_CAT_MAX,
  IMG_TITLE_MAX,
  IMG_BODY_MAX,
} from "./admin-creativos-cola.js?v=10";

export function canEditImageText() {
  return Boolean(getSessionUser());
}

function fieldHtml(id, name, label, value, max) {
  const fid = `imgtext-${name}-${id}`;
  return `
    <label class="creativos-caption-label" for="${fid}">${label}
      <span class="creativos-char-count" data-count-for="${fid}">0/${max}</span>
    </label>
    <input type="text" id="${fid}" class="creativos-imgtext-input" data-field="${name}"
      maxlength="${max}" value="${escapeHtml(value)}">`;
}

export function imageTextEditorHtml(id, seedItem, idPrefix = "imgtext") {
  const safeId = escapeHtml(id);
  const t = resolveImageText(id, seedItem);
  return `
    <div class="creativos-imgtext-editor" data-imgtext-for="${safeId}" hidden>
      <p class="creativos-imgtext-hint">Textos de la imagen (no es el caption). Al guardar se regeneran Feed y Story.</p>
      ${fieldHtml(safeId, "cat", "Categoría (pill)", t.cat, IMG_CAT_MAX)}
      ${fieldHtml(safeId, "title", "Título (headline)", t.title, IMG_TITLE_MAX)}
      <label class="creativos-caption-label" for="${idPrefix}-body-${safeId}">Cuerpo
        <span class="creativos-char-count" data-count-for="${idPrefix}-body-${safeId}">0/${IMG_BODY_MAX}</span>
      </label>
      <textarea id="${idPrefix}-body-${safeId}" class="creativos-caption-textarea creativos-imgtext-body"
        data-field="body" rows="3" maxlength="${IMG_BODY_MAX}">${escapeHtml(t.body)}</textarea>
      <div class="creativos-caption-actions">
        <button type="button" class="btn btn-sm btn-queue-save-imgtext" data-id="${safeId}">💾 Guardar y regenerar</button>
        <button type="button" class="btn light btn-sm btn-queue-cancel-imgtext" data-id="${safeId}">Cancelar</button>
      </div>
    </div>`;
}

export function imageTextEditButtonHtml(id) {
  if (!canEditImageText()) return "";
  return `<button type="button" class="btn light btn-sm btn-queue-edit-imgtext" data-id="${escapeHtml(id)}" title="Editar textos de la imagen">🖼️ Editar imagen</button>`;
}

export function toggleImageTextEditor(id, open) {
  const box = document.querySelector(`[data-imgtext-for="${CSS.escape(id)}"]`);
  if (!box) return;
  box.hidden = !open;
  if (open) refreshCharCounts(box);
}

function refreshCharCounts(root) {
  root.querySelectorAll("[data-field]").forEach((el) => {
    const max = Number(el.getAttribute("maxlength") || 0);
    const span = root.querySelector(`[data-count-for="${CSS.escape(el.id)}"]`);
    if (span) span.textContent = `${String(el.value || "").length}/${max}`;
  });
}

export function readImageTextFields(id) {
  const box = document.querySelector(`[data-imgtext-for="${CSS.escape(id)}"]`);
  if (!box) return null;
  const get = (name) => box.querySelector(`[data-field="${name}"]`);
  return {
    cat: String(get("cat")?.value || "").trim(),
    title: String(get("title")?.value || "").trim(),
    body: String(get("body")?.value || "").trim(),
  };
}

export async function handleSaveImageTextClick(id, btn, onDone) {
  if (!canEditImageText()) {
    window.alert("Tenés que iniciar sesión para editar estos textos.");
    return;
  }
  const fields = readImageTextFields(id);
  if (!fields) return;
  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "⏳ Regenerando…";
  try {
    const data = await saveImageText(id, fields);
    toggleImageTextEditor(id, false);
    const warn = Array.isArray(data?.warnings) && data.warnings.length
      ? ` (aviso: ${data.warnings.join(", ")})`
      : "";
    window.alert(`Imagen regenerada (Feed + Story).${warn}`);
    if (typeof onDone === "function") onDone(id, fields, data);
  } catch (err) {
    if (!err.auth) window.alert(err.message || "No se pudo guardar / regenerar");
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
}

/** Wire clicks + char counters en el contenedor de creativos. */
export function bindImageTextUi(container, onDone) {
  if (!container || container.dataset.imgtextBound === "1") return;
  container.dataset.imgtextBound = "1";
  container.addEventListener("input", (e) => {
    const el = e.target.closest("[data-field]");
    if (!el) return;
    const box = el.closest(".creativos-imgtext-editor");
    if (box) refreshCharCounts(box);
  });
  container.addEventListener("click", (e) => {
    const edit = e.target.closest(".btn-queue-edit-imgtext");
    if (edit) {
      e.preventDefault();
      toggleImageTextEditor(edit.dataset.id, true);
      return;
    }
    const cancel = e.target.closest(".btn-queue-cancel-imgtext");
    if (cancel) {
      e.preventDefault();
      toggleImageTextEditor(cancel.dataset.id, false);
      return;
    }
    const save = e.target.closest(".btn-queue-save-imgtext");
    if (save) {
      e.preventDefault();
      handleSaveImageTextClick(save.dataset.id, save, onDone);
    }
  });
}
