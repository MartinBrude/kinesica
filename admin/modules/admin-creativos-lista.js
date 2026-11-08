/**
 * Kinésica Admin — Vista de "Lista para publicar en Instagram".
 * Permite a Norberto y Martín ver las piezas seleccionadas con ❤️,
 * estimar las fechas de salida (L/M/V 10:00) y reordenarlas con ⬆️ / ⬇️.
 */

import { escapeHtml } from "./dom.js?v=79";
import {
  getQueuedItems,
  getPublishedItems,
  reorderCola,
  toggleCola,
  subscribeCola,
} from "./admin-creativos-cola.js";

let resolveItem = () => null;

/**
 * Genera las próximas N fechas programadas (Lunes, Miércoles, Viernes 10:00 hs).
 */
function getNextSlots(count) {
  const slots = [];
  const days = [1, 3, 5]; // 1: Lun, 3: Mié, 5: Vie
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
        <p>Hacé click en la pestaña <strong>🎨 Catálogo de piezas</strong> y tocá el corazón <strong>❤️ Me gusta</strong> en las publicaciones que quieras subir.</p>
      </div>`;
    return;
  }

  let html = `
    <div class="creativos-queue-header">
      <p class="creativos-queue-info">
        📅 <strong>Automatización activa:</strong> Publica 3 veces por semana (<strong>Lunes, Miércoles y Viernes a las 10:00 hs</strong>).
        Podés cambiar el orden con <strong>⬆️ Subir</strong> y <strong>⬇️ Bajar</strong> para elegir cuál sale primero.
      </p>
    </div>
    <div class="creativos-queue-list">`;

  if (!queued.length) {
    html += `
      <div class="creativos-empty">
        <p>No tenés publicaciones pendientes en cola. Dale ❤️ a nuevas piezas en el catálogo.</p>
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
            <p class="creativos-queue-snippet">${escapeHtml((q.caption || full.copy || "").slice(0, 160))}...</p>
            ${q.last_error ? `<p class="creativos-queue-error">⚠️ ${escapeHtml(q.last_error)}</p>` : ""}
          </div>
          <div class="creativos-queue-actions">
            <button type="button" class="btn light btn-sm btn-queue-up" data-id="${escapeHtml(q.creativo_id)}" ${isFirst ? "disabled" : ""} title="Mover antes en la cola">⬆️ Subir</button>
            <button type="button" class="btn light btn-sm btn-queue-down" data-id="${escapeHtml(q.creativo_id)}" ${isLast ? "disabled" : ""} title="Mover después en la cola">⬇️ Bajar</button>
            <button type="button" class="btn light btn-sm btn-queue-remove" data-id="${escapeHtml(q.creativo_id)}" title="Quitar de la lista de publicaciones">💔 Quitar</button>
          </div>
        </article>`;
    });
  }

  html += `</div>`;

  if (published.length) {
    html += `
      <details class="creativos-published-section">
        <summary>📜 Ver historial de ${published.length} publicaciones ya realizadas en Instagram</summary>
        <div class="creativos-published-list">
          ${published.map((p) => `
            <div class="creativos-published-item">
              <span>✅ <strong>${escapeHtml(p.published_on || "")}</strong> — ${escapeHtml(p.title || p.creativo_id)}</span>
            </div>`).join("")}
        </div>
      </details>`;
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
  });

  subscribeCola(() => {
    if (panelQueue && !panelQueue.hidden) {
      renderQueueView();
    }
  });
}
