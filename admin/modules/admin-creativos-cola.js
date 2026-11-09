/** Estado de cola Instagram + copies + flag de servicio (instagram_cola.php). */
import { api } from "./api.js?v=79";

let colaItems = [];
let colaMap = new Map();
let captionOverrides = new Map();
let serviceEnabled = true;
let subscribers = [];

export function subscribeCola(fn) {
  if (typeof fn === "function") subscribers.push(fn);
}
function notify() {
  subscribers.forEach((fn) => { try { fn(colaItems); } catch (e) { console.error(e); } });
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
  if (data?.copies) setCopies(data.copies);
  if (typeof data?.enabled === "boolean") serviceEnabled = data.enabled;
  setList(data?.items);
}
export function isServiceEnabled() { return serviceEnabled !== false; }

function setList(items) {
  colaItems = Array.isArray(items) ? items : [];
  colaMap = new Map(colaItems.map((r) => [r.creativo_id, r]));
  notify();
}

/** WhatsApp de Clara (bot) — reemplaza el de Norberto en captions IG. */
const NORBERTO_WA_DISPLAY = "+54 9 11 6156-4311";
const CLARA_WA_DISPLAY = "+54 9 11 3178-1733";
const NORBERTO_WA_DIGITS = "5491161564311";
const CLARA_WA_DIGITS = "5491131781733";

export function normalizeIgCaptionPhone(text) {
  return String(text || "")
    .split(NORBERTO_WA_DISPLAY).join(CLARA_WA_DISPLAY)
    .split(NORBERTO_WA_DIGITS).join(CLARA_WA_DIGITS);
}

/** Caption efectivo: override DB → cola → seed del catálogo. */
export function resolveCaption(id, seedItem) {
  let text = "";
  if (captionOverrides.has(id)) text = captionOverrides.get(id);
  else {
    const row = colaMap.get(id);
    if (row?.caption) text = row.caption;
    else text = seedItem?.copy || seedItem?.body || "";
  }
  return normalizeIgCaptionPhone(text);
}

export function getCaptionOverride(id) {
  return captionOverrides.get(id) || null;
}

export function getColaList() { return colaItems; }
export function getQueuedItems() {
  return colaItems.filter((r) => r.status === "queued" || r.status === "publishing");
}
export function getPublishedItems() { return colaItems.filter((r) => r.status === "published"); }
export function stateOf(id) { return colaMap.get(id)?.status || "none"; }
export function itemOf(id) { return colaMap.get(id) || null; }
export const CAPTION_MAX = 2200;

export function getPublicationDetails(id) {
  const row = colaMap.get(id);
  if (!row || row.status !== "published") return null;
  const feed = Boolean(row.feed_media_id);
  const story = Boolean(row.story_media_id);
  let channelText = "Feed + Story";
  let badgeClass = "is-both";
  if (feed && !story) { channelText = "Solo Post"; badgeClass = "is-feed"; }
  else if (!feed && story) { channelText = "Solo Story"; badgeClass = "is-story"; }
  return {
    date: row.published_on || "", feed, story,
    feedId: row.feed_media_id, storyId: row.story_media_id,
    channelText, badgeClass, error: row.last_error,
  };
}

export function orderOf(id) {
  const idx = getQueuedItems().findIndex((r) => r.creativo_id === id);
  return idx >= 0 ? idx + 1 : null;
}

export async function loadCola() {
  try {
    applyPayload(await api("instagram_cola.php"));
  } catch (err) {
    if (!err.auth) console.warn("No se pudo cargar la cola de Instagram", err);
  }
}

export async function toggleCola(id, itemResolver) {
  const item = itemResolver(id);
  if (!item) return;
  const s = stateOf(id);
  if (s === "published" || s === "publishing" || s === "failed") {
    window.alert(
      s === "published" ? "Esta pieza ya fue publicada."
        : s === "publishing" ? "Hay una publicación en curso."
          : "Esta pieza falló y el canal quedó reservado para no duplicar en Instagram."
    );
    return;
  }
  try {
    const body = s !== "queued"
      ? { action: "add", id: item.id, title: item.title, caption: resolveCaption(item.id, item), feed_path: item.feedUrl, story_path: item.storyUrl }
      : { action: "remove", id: item.id };
    applyPayload(await api("instagram_cola.php", { method: "POST", body }));
  } catch (err) {
    if (!err.auth) window.alert(err.message || "No se pudo actualizar la cola de Instagram");
  }
}

export async function reorderCola(orderedIds) {
  try {
    applyPayload(await api("instagram_cola.php", { method: "POST", body: { action: "reorder", ids: orderedIds } }));
  } catch (err) {
    if (!err.auth) window.alert(err.message || "No se pudo reordenar la cola");
  }
}

export async function saveCaption(id, caption) {
  const text = normalizeIgCaptionPhone(String(caption || "").trim());
  if (!text || text.length > CAPTION_MAX) {
    throw Object.assign(new Error(`El texto debe tener entre 1 y ${CAPTION_MAX} caracteres`), { auth: false });
  }
  applyPayload(await api("instagram_cola.php", {
    method: "POST", body: { action: "update_caption", id, caption: text },
  }));
}

export function queuedChannel(id) {
  const ch = itemOf(id)?.channels;
  return ch === "feed" || ch === "story" || ch === "both" ? ch : "both";
}

let publishInFlight = false;

export async function publishNow(id, channel, itemResolver) {
  const item = itemResolver(id);
  if (!item) return;
  if (publishInFlight) {
    window.alert("Ya hay una publicación en curso. Esperá a que termine.");
    throw new Error("publicación en curso");
  }
  publishInFlight = true;
  try {
    const data = await api("instagram_cola.php", {
      method: "POST", timeoutMs: 300000,
      body: {
        action: "publish_now", id: item.id, channel: channel || queuedChannel(id),
        title: item.title, caption: resolveCaption(item.id, item),
        feed_path: item.feedUrl, story_path: item.storyUrl,
      },
    });
    applyPayload(data);
    return data.result;
  } catch (err) {
    if (!err.auth && err.message !== "publicación en curso") {
      window.alert(err.message || "No se pudo publicar en Instagram");
    }
    throw err;
  } finally {
    publishInFlight = false;
  }
}

export async function saveChannels(id, channel) {
  applyPayload(await api("instagram_cola.php", { method: "POST", body: { action: "update_channels", id, channel } }));
}
export async function setServiceEnabled(enabled) {
  applyPayload(await api("instagram_cola.php", { method: "POST", body: { action: "set_enabled", enabled: !!enabled } }));
}
export function _setListForTesting(items) { setList(items); }
