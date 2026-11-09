/**
 * Kinésica Admin — Edición de caption (copy Instagram) en la cola de Creativos.
 * Persistido vía update_caption (override de catálogo + cola queued).
 */

import { escapeHtml } from "./dom.js?v=79";
import {
  resolveCaption,
  saveCaption,
  saveChannels,
  isServiceEnabled,
  setServiceEnabled,
  CAPTION_MAX,
} from "./admin-creativos-cola.js?v=7";

const CHANNEL_LABELS = { both: "Feed + Story", feed: "Solo Feed", story: "Solo Story" };

export function channelSelectHtml(q) {
  const ch = ["feed", "story", "both"].includes(q.channels) ? q.channels : "both";
  const id = escapeHtml(q.creativo_id);
  const opts = Object.entries(CHANNEL_LABELS)
    .map(([value, label]) => `<option value="${value}"${value === ch ? " selected" : ""}>${label}</option>`)
    .join("");
  return `
    <label class="creativos-channel-label">Canal
      <select class="creativos-channel-select" data-id="${id}" title="Qué publicar el día de salida / Publicar ya">
        ${opts}
      </select>
    </label>`;
}

export function channelLabel(channels) {
  const ch = ["feed", "story", "both"].includes(channels) ? channels : "both";
  return CHANNEL_LABELS[ch];
}

export function captionSnippetHtml(q, seedItem) {
  const text = (q.caption || resolveCaption(q.creativo_id, seedItem) || "").trim();
  const preview = text.length > 140 ? `${text.slice(0, 140)}…` : text;
  return `
    ${channelSelectHtml(q)}
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
  if (!caption || caption.length > CAPTION_MAX) {
    window.alert(`El texto debe tener entre 1 y ${CAPTION_MAX} caracteres (límite de Instagram).`);
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

export async function handleChannelChange(select) {
  select.disabled = true;
  try {
    await saveChannels(select.dataset.id, select.value);
  } catch (err) {
    if (!err.auth) window.alert(err.message || "No se pudo guardar el canal");
  } finally {
    select.disabled = false;
  }
}

export function serviceToggleHtml() {
  const on = isServiceEnabled();
  return `
    <div class="creativos-service-bar ${on ? "is-on" : "is-off"}">
      <p class="creativos-queue-info">
        ${on
    ? "📅 <strong>Automatización activa:</strong> Publica Lun/Mié/Vie a las 10:00 hs (Argentina). Arrastrá para reordenar · ⚡ Publicar ya · selector de canal."
    : "⏸️ <strong>Automatización pausada:</strong> el cron no publica. Podés seguir armando la cola; reactivá cuando quieras."}
      </p>
      <button type="button" class="btn btn-sm btn-creativos-service-toggle ${on ? "is-on" : "is-off"}" data-enabled="${on ? "0" : "1"}">
        ${on ? "⏸️ Pausar publicaciones" : "▶️ Activar publicaciones"}
      </button>
    </div>`;
}

export async function handleServiceToggleClick(btn) {
  const next = btn.dataset.enabled === "1";
  const msg = next
    ? "¿Activar el servicio de publicaciones automáticas en Instagram?"
    : "¿Pausar el servicio? El cron dejará de publicar hasta que lo reactives.";
  if (!window.confirm(msg)) return;
  btn.disabled = true;
  try {
    await setServiceEnabled(next);
  } catch (err) {
    if (!err.auth) window.alert(err.message || "No se pudo cambiar el estado del servicio");
  } finally {
    btn.disabled = false;
  }
}
