/**
 * Kinésica Admin — Estado de la cola y publicaciones en Instagram.
 * Gestiona la sincronización con el servidor (instagram_cola.php),
 * estado ("liked", encolada, publicada como Feed / Story / Ambas) y publicación directa.
 */

import { api } from "./api.js?v=79";

let colaItems = [];
let colaMap = new Map();
let captionOverrides = new Map();
let subscribers = [];

export function subscribeCola(fn) {
  if (typeof fn === "function") subscribers.push(fn);
}

function notify() {
  subscribers.forEach((fn) => {
    try { fn(colaItems); } catch (e) { console.error(e); }
  });
}

function setCopies(copies) {
  captionOverrides = new Map();
  if (copies && typeof copies === "object") {
    Object.entries(copies).forEach(([id, caption]) => {
      if (id && typeof caption === "string" && caption.trim()) captionOverrides.set(id, caption);
    });
  }
}

function applyPayload(data) {
  if (data && data.copies) setCopies(data.copies);
  setList(data?.items);
}

function setList(items) {
  colaItems = Array.isArray(items) ? items : [];
  colaMap = new Map(colaItems.map((r) => [r.creativo_id, r]));
  notify();
  if (typeof document !== "undefined") refreshColaButtons();
}

/** Caption efectivo: override DB → cola → seed del catálogo. */
export function resolveCaption(id, seedItem) {
  if (captionOverrides.has(id)) return captionOverrides.get(id);
  const row = colaMap.get(id);
  if (row?.caption) return row.caption;
  return seedItem?.copy || seedItem?.body || "";
}

export function getCaptionOverride(id) {
  return captionOverrides.get(id) || null;
}

export function getColaList() { return colaItems; }
export function getQueuedItems() { return colaItems.filter((r) => r.status === "queued"); }
export function getPublishedItems() { return colaItems.filter((r) => r.status === "published"); }
export function stateOf(id) { return colaMap.get(id)?.status || "none"; }
export function itemOf(id) { return colaMap.get(id) || null; }

export function getPublicationDetails(id) {
  const row = colaMap.get(id);
  if (!row || row.status !== "published") return null;
  const feed = Boolean(row.feed_media_id);
  const story = Boolean(row.story_media_id);
  let channelText = "Feed + Story";
  let badgeClass = "is-both";
  if (feed && !story) {
    channelText = "Solo Post";
    badgeClass = "is-feed";
  } else if (!feed && story) {
    channelText = "Solo Story";
    badgeClass = "is-story";
  }
  return {
    date: row.published_on || "",
    feed,
    story,
    feedId: row.feed_media_id,
    storyId: row.story_media_id,
    channelText,
    badgeClass,
    error: row.last_error,
  };
}

export function orderOf(id) {
  const queued = getQueuedItems();
  const idx = queued.findIndex((r) => r.creativo_id === id);
  return idx >= 0 ? idx + 1 : null;
}

export function colaHeartHtml(item) {
  const s = stateOf(item.id);
  const ord = orderOf(item.id);
  const pub = getPublicationDetails(item.id);
  if (pub) {
    return `<button type="button" class="btn-creativo-heart is-published" data-cola-id="${item.id}" title="Publicada el ${pub.date} (${pub.channelText}). Click para re-encolar" aria-label="Publicada">✅</button>`;
  }
  const isLiked = s === "queued";
  const label = isLiked ? `❤️ #${ord}` : "🤍";
  const title = isLiked ? `En lista (#${ord}) · Click para quitar` : "Me gusta · Sumar a lista para publicar";
  return `<button type="button" class="btn-creativo-heart ${isLiked ? "is-liked" : ""}" data-cola-id="${item.id}" title="${title}" aria-label="${title}">${label}</button>`;
}

export function colaBadgeHtml(item) {
  const pub = getPublicationDetails(item.id);
  if (!pub) return "";
  return `<span class="creativo-card-pub-badge ${pub.badgeClass}">✅ ${pub.channelText}</span>`;
}

export function colaButtonHtml(item) {
  const s = stateOf(item.id);
  const ord = orderOf(item.id);
  const pub = getPublicationDetails(item.id);
  if (pub) {
    return `<button type="button" class="btn btn-sm btn-creativo-cola is-published" data-cola-id="${item.id}" title="Publicada el ${pub.date} (${pub.channelText}). Click para programar de nuevo">✅ ${pub.channelText} · Re-encolar</button>`;
  }
  if (s === "queued") {
    return `<button type="button" class="btn btn-sm btn-creativo-cola is-queued" data-cola-id="${item.id}" title="Publicación #${ord} en la cola. Click para quitar">❤️ Programada (#${ord})</button>`;
  }
  if (s === "failed") {
    return `<button type="button" class="btn btn-sm btn-creativo-cola is-failed" data-cola-id="${item.id}" title="No se pudo publicar. Click para reintentar">⚠️ Falló · reintentar</button>`;
  }
  return `<button type="button" class="btn btn-sm btn-creativo-cola is-none" data-cola-id="${item.id}" title="Sumar a la lista de publicaciones automáticas">🤍 Me gusta (programar)</button>`;
}

export function refreshColaButtons() {
  document.querySelectorAll("[data-cola-id]").forEach((el) => {
    const id = el.dataset.colaId;
    const s = stateOf(id);
    const ord = orderOf(id);
    const pub = getPublicationDetails(id);
    if (el.classList.contains("btn-creativo-heart")) {
      if (pub) {
        el.className = "btn-creativo-heart is-published";
        el.textContent = "✅";
        el.title = `Publicada el ${pub.date} (${pub.channelText}). Click para re-encolar`;
      } else {
        const isLiked = s === "queued";
        el.className = `btn-creativo-heart ${isLiked ? "is-liked" : ""}`;
        el.textContent = isLiked ? `❤️ #${ord}` : "🤍";
        el.title = isLiked ? `En lista (#${ord}) · Click para quitar` : "Me gusta · Sumar a lista para publicar";
      }
    } else if (el.classList.contains("btn-creativo-cola")) {
      el.className = `btn btn-sm btn-creativo-cola is-${s}`;
      if (pub) {
        el.textContent = `✅ ${pub.channelText} · Re-encolar`;
        el.title = `Publicada el ${pub.date} (${pub.channelText}). Click para programar de nuevo`;
      } else if (s === "queued") {
        el.textContent = `❤️ Programada (#${ord})`;
        el.title = `Publicación #${ord} en la cola. Click para quitar`;
      } else if (s === "failed") {
        el.textContent = "⚠️ Falló · reintentar";
      } else {
        el.textContent = "🤍 Me gusta (programar)";
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
    applyPayload(data);
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
      ? { action: "add", id: item.id, title: item.title, caption: resolveCaption(item.id, item), feed_path: item.feedUrl, story_path: item.storyUrl }
      : { action: "remove", id: item.id };
    const data = await api("instagram_cola.php", { method: "POST", body });
    applyPayload(data);
  } catch (err) {
    if (!err.auth) window.alert(err.message || "No se pudo actualizar la cola de Instagram");
  }
}

export async function reorderCola(orderedIds) {
  try {
    const data = await api("instagram_cola.php", { method: "POST", body: { action: "reorder", ids: orderedIds } });
    applyPayload(data);
  } catch (err) {
    if (!err.auth) window.alert(err.message || "No se pudo reordenar la cola");
  }
}

export async function saveCaption(id, caption) {
  const data = await api("instagram_cola.php", {
    method: "POST",
    body: { action: "update_caption", id, caption },
  });
  applyPayload(data);
  return data;
}

export function queuedChannel(id) {
  const ch = itemOf(id)?.channels;
  return ch === "feed" || ch === "story" || ch === "both" ? ch : "both";
}

export async function publishNow(id, channel, itemResolver) {
  const item = itemResolver(id);
  if (!item) return;
  try {
    const body = {
      action: "publish_now", id: item.id, channel: channel || queuedChannel(id),
      title: item.title, caption: resolveCaption(item.id, item),
      feed_path: item.feedUrl, story_path: item.storyUrl,
    };
    const data = await api("instagram_cola.php", { method: "POST", body, timeoutMs: 180000 });
    applyPayload(data);
    return data.result;
  } catch (err) {
    if (!err.auth) window.alert(err.message || "No se pudo publicar en Instagram");
    throw err;
  }
}

export async function saveChannels(id, channel) {
  applyPayload(await api("instagram_cola.php", { method: "POST", body: { action: "update_channels", id, channel } }));
}

export function _setListForTesting(items) {
  setList(items);
}
