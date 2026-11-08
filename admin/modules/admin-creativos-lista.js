/**
 * Kinésica Admin — Vista de "Lista para publicar en Instagram".
 * Muestra las piezas encoladas con slot estimado, reordenamiento (⬆️/⬇️),
 * publicación inmediata manual (⚡) y el historial detallado de qué se publicó
 * (Feed, Story o ambos) con fecha e identificadores.
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
} from "./admin-creativos-cola.js";

let resolveItem = () => null;

function getNextSlots(count) {
  const slots = [];
  const days = [1, 3, 5];
  const names = ["Dom", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const d = new Date();
  while (slots.length < count) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (days.includes(day)) {
      slots.push(`${names[day]} ${d.getDate()} de ${months[d.getMonth()]} · 10:00 hs`);
    }
  }
  return slots;
}

export function renderQueueView() {
  const container = document.getElementById("creativos-tab-panel-queue");
  if (!container) return;

  const queued = getQueuedItems();
  const published = getPublishedItems();
  const slots = getNextSlots(queued.length);

  if (!queued.length && !published.length) {
    container.innerHTML = `
      <div class="creativos-empty creativos-queue-empty">
        <p>🤍 <strong>No hay publicaciones en la lista todavía.</strong></p>
        <p>Hacé click en <strong>🎨 Catálogo de piezas</strong> y tocá <strong>❤️ Me gusta</strong> en las que quieras programar.</p>
      </div>`;
    return;
  }

  let html = `
    <div class="creativos-queue-header">
      <p class="creativos-queue-info">
        📅 <strong>Automatización activa:</strong> Publica 3 veces por semana (<strong>Lunes, Miércoles y Viernes a las 10:00 hs</strong>).
        El orden define qué pieza sale primero. Podés usar <strong>⬆️ Subir</strong>, <strong>⬇️ Bajar</strong> o <strong>⚡ Publicar ya</strong> para subir una pieza inmediatamente.
      </p>
    </div>
    <div class="creativos-queue-list">`;

  if (!queued.length) {
    html += `
      <div class="creativos-empty" style="margin-bottom: 20px;">
        <p>No tenés publicaciones pendientes en cola. Dale ❤️ a nuevas piezas en el catálogo para sumarlas.</p>
      </div>`;
  } else {
    queued.forEach((q, idx) => {
      const full = resolveItem(q.creativo_id) || {};
      const img = full.feedUrl ? `${full.feedUrl}?v=${Date.now()}` : "";
      const isFirst = idx === 0;
      const isLast = idx === queued.length - 1;
      const slotText = slots[idx] || `Posición #${idx + 1}`;

      html += `
        <article class="creativos-queue-item" data-id="${escapeHtml(q.creativo_id)}">
          <div class="creativos-queue-pos">
            <span class="creativos-pos-badge">#${idx + 1}</span>
          </div>
          <div class="creativos-queue-thumb">
            ${img ? `<img src="${img}" alt="${escapeHtml(q.title)}" loading="lazy">` : ""}
          </div>
          <div class="creativos-queue-details">
            <div class="creativos-queue-slot-date">⏰ Salida programada: <strong>${escapeHtml(slotText)}</strong></div>
            <h4 class="creativos-queue-title">${escapeHtml(q.title || full.title || q.creativo_id)}</h4>
            <p class="creativos-queue-snippet">${escapeHtml((q.caption || full.copy || "").slice(0, 140))}...</p>
            ${q.last_error ? `<p class="creativos-queue-error">⚠️ ${escapeHtml(q.last_error)}</p>` : ""}
          </div>
          <div class="creativos-queue-actions">
            <button type="button" class="btn light btn-sm btn-queue-up" data-id="${escapeHtml(q.creativo_id)}" ${isFirst ? "disabled" : ""} title="Mover antes en la cola">⬆️ Subir</button>
            <button type="button" class="btn light btn-sm btn-queue-down" data-id="${escapeHtml(q.creativo_id)}" ${isLast ? "disabled" : ""} title="Mover después en la cola">⬇️ Bajar</button>
            <button type="button" class="btn light btn-sm btn-queue-publish-now" data-id="${escapeHtml(q.creativo_id)}" title="Publicar inmediatamente en Instagram (Feed + Story)">⚡ Publicar ya</button>
            <button type="button" class="btn light btn-sm btn-queue-remove" data-id="${escapeHtml(q.creativo_id)}" title="Quitar de la lista">💔 Quitar</button>
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
      const full = resolveItem(p.creativo_id) || {};
      const img = full.feedUrl ? `${full.feedUrl}?v=${Date.now()}` : "";
      const pub = getPublicationDetails(p.creativo_id) || {};
      const channels = [];
      if (pub.feed) channels.push(`<span class="pub-chan-badge is-feed">📱 Post Feed</span>`);
      if (pub.story) channels.push(`<span class="pub-chan-badge is-story">📲 Historia</span>`);
      if (!pub.feed && !pub.story) channels.push(`<span class="pub-chan-badge">📸 Instagram</span>`);

      html += `
        <article class="creativos-published-card">
          <div class="creativos-queue-thumb">
            ${img ? `<img src="${img}" alt="${escapeHtml(p.title)}" loading="lazy">` : ""}
          </div>
          <div class="creativos-queue-details">
            <div class="creativos-published-meta">
              <span class="pub-date">🗓️ Publicada el <strong>${escapeHtml(pub.date || p.published_on || "")}</strong></span>
              <div class="pub-channels">${channels.join(" ")}</div>
            </div>
            <h4 class="creativos-queue-title">${escapeHtml(p.title || full.title || p.creativo_id)}</h4>
            ${pub.error ? `<p class="creativos-queue-error">⚠️ ${escapeHtml(pub.error)}</p>` : ""}
          </div>
          <div class="creativos-queue-actions">
            <button type="button" class="btn light btn-sm btn-queue-readd" data-id="${escapeHtml(p.creativo_id)}" title="Volver a programar esta pieza en la cola">🔄 Re-encolar</button>
          </div>
        </article>`;
    });
    html += `</div></div>`;
  }

  container.innerHTML = html;
}

function handleReorderClick(id, direction) {
  const queued = getQueuedItems();
  const idx = queued.findIndex((r) => r.creativo_id === id);
  if (idx < 0) return;
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= queued.length) return;

  const copy = [...queued];
  const [moved] = copy.splice(idx, 1);
  copy.splice(targetIdx, 0, moved);

  reorderCola(copy.map((r) => r.creativo_id));
}

async function handlePublishNowClick(id, btn) {
  const item = resolveItem(id);
  if (!item) return;
  const ok = window.confirm(`¿Publicar "${item.title}" ahora mismo en Instagram (Feed + Story)?`);
  if (!ok) return;
  btn.disabled = true;
  btn.textContent = "⏳ Publicando...";
  try {
    await publishNow(id, "both", resolveItem);
    window.alert("¡Publicación enviada con éxito a Instagram!");
  } catch (e) {
    // publishNow ya alerta
  } finally {
    btn.disabled = false;
    btn.textContent = "⚡ Publicar ya";
  }
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

  container.addEventListener("click", (e) => {
    const upBtn = e.target.closest(".btn-queue-up");
    if (upBtn) return handleReorderClick(upBtn.dataset.id, "up");
    const downBtn = e.target.closest(".btn-queue-down");
    if (downBtn) return handleReorderClick(downBtn.dataset.id, "down");
    const rmBtn = e.target.closest(".btn-queue-remove");
    if (rmBtn) return toggleCola(rmBtn.dataset.id, resolveItem);
    const readdBtn = e.target.closest(".btn-queue-readd");
    if (readdBtn) return toggleCola(readdBtn.dataset.id, resolveItem);
    const pubNowBtn = e.target.closest(".btn-queue-publish-now");
    if (pubNowBtn) return handlePublishNowClick(pubNowBtn.dataset.id, pubNowBtn);
  });

  subscribeCola(() => {
    if (panelQueue && !panelQueue.hidden) {
      renderQueueView();
    }
  });
}
