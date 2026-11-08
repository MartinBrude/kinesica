/**
 * Kinésica Admin — Estado de la cola de publicación en Instagram.
 * Gestiona la sincronización con el servidor (instagram_cola.php),
 * estado de cada pieza ("liked"/encolada) y llamadas a reordenar.
 */

import { api } from "./api.js?v=78";

let colaItems = [];
let colaMap = new Map();
let subscribers = [];

export function subscribeCola(fn) {
  if (typeof fn === "function") subscribers.push(fn);
}

function notify() {
  subscribers.forEach((fn) => {
    try { fn(colaItems); } catch (e) { console.error(e); }
  });
}

function setList(items) {
  colaItems = Array.isArray(items) ? items : [];
  colaMap = new Map(colaItems.map((r) => [r.creativo_id, r]));
  notify();
  refreshColaButtons();
}

export function getColaList() {
  return colaItems;
}

export function getQueuedItems() {
  return colaItems.filter((r) => r.status === "queued");
}

export function getPublishedItems() {
  return colaItems.filter((r) => r.status === "published");
}

export function stateOf(id) {
  return colaMap.get(id)?.status || "none";
}

export function orderOf(id) {
  const queued = getQueuedItems();
  const idx = queued.findIndex((r) => r.creativo_id === id);
  return idx >= 0 ? idx + 1 : null;
}

export function colaHeartHtml(item) {
  const s = stateOf(item.id);
  const ord = orderOf(item.id);
  const isLiked = s === "queued";
  const label = isLiked ? `❤️ #${ord}` : "🤍";
  const title = isLiked ? `En lista (#${ord}) · Click para quitar` : "Me gusta · Sumar a lista para publicar";
  return `<button type="button" class="btn-creativo-heart ${isLiked ? "is-liked" : ""}" data-cola-id="${item.id}" title="${title}" aria-label="${title}">${label}</button>`;
}

export function colaButtonHtml(item) {
  const s = stateOf(item.id);
  const ord = orderOf(item.id);
  let text = "🤍 Me gusta (programar)";
  let title = "Sumar a la lista de publicaciones automáticas";
  if (s === "queued") {
    text = `❤️ Programada (#${ord})`;
    title = `Publicación #${ord} en la cola. Click para quitar`;
  } else if (s === "published") {
    text = "📸 Publicada · volver a encolar";
    title = "Ya se publicó en Instagram. Click para encolarla de nuevo";
  } else if (s === "failed") {
    text = "⚠️ Falló · reintentar";
    title = "No se pudo publicar. Click para reintentar";
  }
  return `<button type="button" class="btn btn-sm btn-creativo-cola is-${s}" data-cola-id="${item.id}" title="${title}">${text}</button>`;
}

export function refreshColaButtons() {
  document.querySelectorAll("[data-cola-id]").forEach((el) => {
    const id = el.dataset.colaId;
    const s = stateOf(id);
    const ord = orderOf(id);
    if (el.classList.contains("btn-creativo-heart")) {
      const isLiked = s === "queued";
      el.classList.toggle("is-liked", isLiked);
      el.textContent = isLiked ? `❤️ #${ord}` : "🤍";
      el.title = isLiked ? `En lista (#${ord}) · Click para quitar` : "Me gusta · Sumar a lista para publicar";
    } else {
      el.className = `btn btn-sm btn-creativo-cola is-${s}`;
      if (s === "queued") {
        el.textContent = `❤️ Programada (#${ord})`;
        el.title = `Publicación #${ord} en la cola. Click para quitar`;
      } else if (s === "published") {
        el.textContent = "📸 Publicada · volver a encolar";
        el.title = "Ya se publicó en Instagram. Click para encolarla de nuevo";
      } else if (s === "failed") {
        el.textContent = "⚠️ Falló · reintentar";
        el.title = "No se pudo publicar. Click para reintentar";
      } else {
        el.textContent = "🤍 Me gusta (programar)";
        el.title = "Sumar a la lista de publicaciones automáticas";
      }
    }
  });

  const queuedCount = getQueuedItems().length;
  const badge = document.getElementById("creativos-queue-badge");
  if (badge) badge.textContent = String(queuedCount);
}

export async function loadCola() {
  try {
    const data = await api("instagram_cola.php");
    setList(data.items);
  } catch (err) {
    if (!err.auth) console.warn("No se pudo cargar la cola de Instagram", err);
  }
}

export async function toggleCola(id, itemResolver) {
  const item = itemResolver(id);
  if (!item) return;
  const adding = stateOf(id) !== "queued";
  try {
    const body = adding
      ? {
          action: "add",
          id: item.id,
          title: item.title,
          caption: item.copy || item.body,
          feed_path: item.feedUrl,
          story_path: item.storyUrl,
        }
      : { action: "remove", id: item.id };
    const data = await api("instagram_cola.php", { method: "POST", body });
    setList(data.items);
  } catch (err) {
    if (!err.auth) window.alert(err.message || "No se pudo actualizar la cola de Instagram");
  }
}

export async function reorderCola(orderedIds) {
  try {
    const data = await api("instagram_cola.php", {
      method: "POST",
      body: { action: "reorder", ids: orderedIds },
    });
    setList(data.items);
  } catch (err) {
    if (!err.auth) window.alert(err.message || "No se pudo reordenar la cola");
  }
}
