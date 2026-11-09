/**
 * Kinésica Admin — Edición de caption (copy Instagram) en la cola de Creativos.
 * Persistido vía update_caption (override de catálogo + cola queued).
 */

import { escapeHtml } from "./dom.js?v=79";
import { resolveCaption, saveCaption } from "./admin-creativos-cola.js?v=3";

export function captionSnippetHtml(q, seedItem) {
  const text = (q.caption || resolveCaption(q.creativo_id, seedItem) || "").trim();
  const preview = text.length > 140 ? `${text.slice(0, 140)}…` : text;
  return `
    <p class="creativos-queue-snippet">${escapeHtml(preview)}</p>
    <button type="button" class="btn light btn-sm btn-queue-edit-caption" data-id="${escapeHtml(q.creativo_id)}" title="Editar texto de publicación">✏️ Editar texto</button>
    <div class="creativos-caption-editor" data-caption-for="${escapeHtml(q.creativo_id)}" hidden>
      <label class="creativos-caption-label" for="caption-${escapeHtml(q.creativo_id)}">Texto que se publica en Instagram (Feed)</label>
      <textarea id="caption-${escapeHtml(q.creativo_id)}" class="creativos-caption-textarea" rows="8">${escapeHtml(text)}</textarea>
      <div class="creativos-caption-actions">
        <button type="button" class="btn btn-sm btn-queue-save-caption" data-id="${escapeHtml(q.creativo_id)}">💾 Guardar</button>
        <button type="button" class="btn light btn-sm btn-queue-cancel-caption" data-id="${escapeHtml(q.creativo_id)}">Cancelar</button>
      </div>
    </div>`;
}

export function toggleCaptionEditor(id, open) {
  const box = document.querySelector(`[data-caption-for="${CSS.escape(id)}"]`);
  if (!box) return;
  box.hidden = !open;
}

export async function handleSaveCaptionClick(id, btn) {
  const box = document.querySelector(`[data-caption-for="${CSS.escape(id)}"]`);
  const ta = box?.querySelector("textarea");
  if (!ta) return;
  const caption = String(ta.value || "").trim();
  if (!caption) {
    window.alert("El texto no puede estar vacío.");
    return;
  }
  btn.disabled = true;
  try {
    await saveCaption(id, caption);
    window.alert("Texto guardado. Vale para la cola y para la próxima vez que encoles esta pieza.");
  } catch (err) {
    if (!err.auth) window.alert(err.message || "No se pudo guardar el texto");
  } finally {
    btn.disabled = false;
  }
}
