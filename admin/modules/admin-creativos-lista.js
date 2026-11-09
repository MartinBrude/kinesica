/**
 * Kinésica Admin — Vista de "Lista para publicar en Instagram".
 * Muestra las piezas encoladas con slot estimado, reordenamiento (Drag & Drop y ⬆️/⬇️),
 * publicación inmediata manual (⚡) y el historial detallado de publicaciones.
 */

import { escapeHtml } from "./dom.js?v=79";
import {
  getQueuedItems,
  getPublishedItems,
  getPublicationDetails,
  reorderCola,
  toggleCola,
  publishNow,
  subscribeCola,
  queuedChannel,
} from "./admin-creativos-cola.js?v=9";
import {
  captionSnippetHtml,
  toggleCaptionEditor,
  handleSaveCaptionClick,
  handleChannelChange,
  handleServiceToggleClick,
  serviceToggleHtml,
  channelLabel,
} from "./admin-creativos-caption.js?v=6";

let resolveItem = () => null, draggedId = null;

function getNextSlots(count) {
  const slots = [], days = [1, 3, 5], names = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"], months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"], d = new Date();
  while (slots.length < count) {
    d.setDate(d.getDate() + 1);
    if (days.includes(d.getDay())) slots.push(`${names[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]} · 10:00 hs`);
  }
  return slots;
}

export function renderQueueView() {
  const container = document.getElementById("creativos-tab-panel-queue");
  if (!container) return;

  const queued = getQueuedItems(), published = getPublishedItems(), slots = getNextSlots(queued.length);

  let html = `<div class="creativos-queue-header">${serviceToggleHtml()}</div><div class="creativos-queue-list">`;

  if (!queued.length && !published.length) {
    html += `
      <div class="creativos-empty creativos-queue-empty">
        <p>🤍 <strong>No hay publicaciones en la lista todavía.</strong></p>
        <p>Andá al <strong>Catálogo</strong> y tocá el <strong>❤️</strong> para sumar piezas.</p>
      </div></div>`;
    container.innerHTML = html;
    return;
  }

  if (!queued.length) {
    html += `<div class="creativos-empty" style="margin-bottom: 20px;"><p>No tenés publicaciones pendientes en cola. Dale ❤️ a nuevas piezas en el catálogo para sumarlas.</p></div>`;
  } else {
    queued.forEach((q, idx) => {
      const full = resolveItem(q.creativo_id) || {}, img = full.feedUrl ? `${full.feedUrl}?v=${Date.now()}` : "";
      const busy = q.status === "publishing";
      const isFirst = idx === 0, isLast = idx === queued.length - 1;
      const slotText = busy ? "Publicando ahora…" : (slots[idx] || `Posición #${idx + 1}`);
      html += `
        <article class="creativos-queue-item${busy ? " is-publishing" : ""}" data-id="${escapeHtml(q.creativo_id)}" draggable="${busy ? "false" : "true"}">
          <div class="creativos-drag-handle" title="Arrastrar para reordenar (Drag & drop)">⋮⋮</div>
          <div class="creativos-queue-pos"><span class="creativos-pos-badge">#${idx + 1}</span></div>
          <div class="creativos-queue-thumb">${img ? `<img src="${img}" alt="${escapeHtml(q.title)}" loading="lazy">` : ""}</div>
          <div class="creativos-queue-details">
            <div class="creativos-queue-slot-date">⏰ ${busy ? "⏳" : "Salida programada:"} <strong>${escapeHtml(slotText)}</strong></div>
            <h4 class="creativos-queue-title">${escapeHtml(q.title || full.title || q.creativo_id)}</h4>
            ${busy ? "" : captionSnippetHtml(q, full)}
            ${q.last_error ? `<p class="creativos-queue-error">⚠️ ${escapeHtml(q.last_error)}</p>` : ""}
          </div>
          <div class="creativos-queue-actions">
            <button type="button" class="btn light btn-sm btn-queue-up" data-id="${escapeHtml(q.creativo_id)}" ${isFirst || busy ? "disabled" : ""} title="Subir prioridad">⬆️</button>
            <button type="button" class="btn light btn-sm btn-queue-down" data-id="${escapeHtml(q.creativo_id)}" ${isLast || busy ? "disabled" : ""} title="Bajar prioridad">⬇️</button>
            <button type="button" class="btn light btn-sm btn-queue-publish-now" data-id="${escapeHtml(q.creativo_id)}" ${busy ? "disabled" : ""} title="Publicar inmediatamente en Instagram">${busy ? "⏳ Publicando…" : "⚡ Publicar ya"}</button>
            <button type="button" class="btn light btn-sm btn-queue-remove" data-id="${escapeHtml(q.creativo_id)}" ${busy ? "disabled" : ""} title="Quitar de la lista">💔</button>
          </div>
        </article>`;
    });
  }
  html += `</div>`;

  if (published.length) {
    html += `
      <div class="creativos-published-section">
        <h3 class="creativos-published-heading">📸 Historial de publicaciones realizadas en Instagram (${published.length})</h3>
        <div class="creativos-published-list">`;
    published.forEach((p) => {
      const full = resolveItem(p.creativo_id) || {}, img = full.feedUrl ? `${full.feedUrl}?v=${Date.now()}` : "";
      const pub = getPublicationDetails(p.creativo_id) || {}, channels = [];
      if (pub.feed) channels.push(`<span class="pub-chan-badge is-feed">📱 Post Feed</span>`);
      if (pub.story) channels.push(`<span class="pub-chan-badge is-story">📲 Historia</span>`);
      if (!pub.feed && !pub.story) channels.push(`<span class="pub-chan-badge">📸 Instagram</span>`);
      html += `
        <article class="creativos-published-card">
          <div class="creativos-queue-thumb">${img ? `<img src="${img}" alt="${escapeHtml(p.title)}" loading="lazy">` : ""}</div>
          <div class="creativos-queue-details">
            <div class="creativos-published-meta">
              <span class="pub-date">🗓️ Publicada el <strong>${escapeHtml(pub.date || p.published_on || "")}</strong></span>
              <div class="pub-channels">${channels.join(" ")}</div>
            </div>
            <h4 class="creativos-queue-title">${escapeHtml(p.title || full.title || p.creativo_id)}</h4>
            ${pub.error ? `<p class="creativos-queue-error">⚠️ ${escapeHtml(pub.error)}</p>` : ""}
          </div>
          <div class="creativos-queue-actions">
            <span class="creativos-published-note" title="No se reencola: evita duplicados en Instagram">🔒 Histórico</span>
          </div>
        </article>`;
    });
    html += `</div></div>`;
  }
  container.innerHTML = html;
}

function moveQueueItem(fromId, target) {
  const queued = getQueuedItems();
  const fromIdx = queued.findIndex((r) => r.creativo_id === fromId);
  const toIdx = typeof target === "number" ? target : queued.findIndex((r) => r.creativo_id === target);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx || toIdx >= queued.length) return;
  const copy = [...queued];
  const [moved] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, moved);
  reorderCola(copy.map((r) => r.creativo_id));
}

function handleReorderClick(id, direction) {
  const queued = getQueuedItems(), idx = queued.findIndex((r) => r.creativo_id === id);
  if (idx >= 0) moveQueueItem(id, direction === "up" ? idx - 1 : idx + 1);
}

async function handlePublishNowClick(id, btn) {
  const item = resolveItem(id);
  const channel = queuedChannel(id);
  const where = channelLabel(channel);
  if (!item || btn.disabled) return;
  if (!window.confirm(`¿Publicar "${item.title}" ahora en Instagram (${where})?\n\nSolo se publica una vez: no pulses de nuevo.`)) return;
  btn.disabled = true;
  btn.textContent = "⏳ Publicando...";
  try {
    await publishNow(id, channel, resolveItem);
    btn.textContent = "✅ Publicado";
    window.alert("¡Publicación enviada con éxito a Instagram!");
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "⚡ Publicar ya";
  }
}

function setupDragAndDrop(container) {
  container.addEventListener("dragstart", (e) => {
    if (e.target.closest(".creativos-caption-editor, textarea, .btn-queue-edit-caption")) {
      e.preventDefault();
      return;
    }
    const item = e.target.closest(".creativos-queue-item");
    if (!item) return;
    draggedId = item.dataset.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedId);
    item.classList.add("is-dragging");
  });
  container.addEventListener("dragover", (e) => {
    const item = e.target.closest(".creativos-queue-item");
    if (!item || !draggedId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    item.classList.add("is-drag-over");
  });
  container.addEventListener("dragleave", (e) => {
    e.target.closest(".creativos-queue-item")?.classList.remove("is-drag-over");
  });
  container.addEventListener("dragend", () => {
    draggedId = null;
    container.querySelectorAll(".creativos-queue-item").forEach((el) => el.classList.remove("is-dragging", "is-drag-over"));
  });
  container.addEventListener("drop", (e) => {
    const item = e.target.closest(".creativos-queue-item");
    e.preventDefault();
    if (!item || !draggedId || item.dataset.id === draggedId) return;
    const src = draggedId;
    draggedId = null;
    moveQueueItem(src, item.dataset.id);
  });
}

export function initListaUI(resolver) {
  resolveItem = resolver;
  const container = document.getElementById("admin-creativos-card");
  if (!container) return;

  const btnCatalog = document.getElementById("btn-creativos-tab-catalog");
  const btnQueue = document.getElementById("btn-creativos-tab-queue");
  const panelCatalog = document.getElementById("creativos-tab-panel-catalog");
  const panelQueue = document.getElementById("creativos-tab-panel-queue");

  function switchTab(view) {
    const isQueue = view === "queue";
    if (btnCatalog) btnCatalog.classList.toggle("is-active", !isQueue);
    if (btnQueue) btnQueue.classList.toggle("is-active", isQueue);
    if (panelCatalog) panelCatalog.hidden = isQueue;
    if (panelQueue) {
      panelQueue.hidden = !isQueue;
      if (isQueue) renderQueueView();
    }
  }

  if (btnCatalog && btnQueue) {
    btnCatalog.addEventListener("click", () => switchTab("catalog"));
    btnQueue.addEventListener("click", () => switchTab("queue"));
  }

  container.addEventListener("change", (e) => {
    const sel = e.target.closest(".creativos-channel-select");
    if (sel) handleChannelChange(sel);
  });

  container.addEventListener("click", (e) => {
    if (e.target.closest(".creativos-caption-textarea, .creativos-channel-select")) return;
    const svc = e.target.closest(".btn-creativos-service-toggle");
    if (svc) return handleServiceToggleClick(svc);
    const up = e.target.closest(".btn-queue-up"), down = e.target.closest(".btn-queue-down");
    if (up) return handleReorderClick(up.dataset.id, "up");
    if (down) return handleReorderClick(down.dataset.id, "down");
    const editCap = e.target.closest(".btn-queue-edit-caption");
    if (editCap) return toggleCaptionEditor(editCap.dataset.id, true);
    const cancelCap = e.target.closest(".btn-queue-cancel-caption");
    if (cancelCap) return toggleCaptionEditor(cancelCap.dataset.id, false);
    const saveCap = e.target.closest(".btn-queue-save-caption");
    if (saveCap) return handleSaveCaptionClick(saveCap.dataset.id, saveCap);
    const rm = e.target.closest(".btn-queue-remove");
    if (rm) return toggleCola(rm.dataset.id, resolveItem);
    const pub = e.target.closest(".btn-queue-publish-now");
    if (pub) return handlePublishNowClick(pub.dataset.id, pub);
  });

  setupDragAndDrop(container);

  subscribeCola(() => {
    if (panelQueue && !panelQueue.hidden) renderQueueView();
  });
}
