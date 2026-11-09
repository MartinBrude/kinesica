/** HTML/pintura de corazones, badges y botones de cola Instagram. */
import {
  stateOf,
  orderOf,
  getPublicationDetails,
  getQueuedItems,
  subscribeCola,
} from "./admin-creativos-cola.js?v=8";

export function colaHeartHtml(item) {
  const s = stateOf(item.id);
  const ord = orderOf(item.id);
  const pub = getPublicationDetails(item.id);
  if (pub) {
    return `<button type="button" class="btn-creativo-heart is-published" data-cola-id="${item.id}" title="Publicada el ${pub.date} (${pub.channelText})" aria-label="Publicada" disabled>✅</button>`;
  }
  if (s === "publishing") {
    return `<button type="button" class="btn-creativo-heart is-publishing" data-cola-id="${item.id}" title="Publicación en curso" disabled>⏳</button>`;
  }
  if (s === "failed") {
    return `<button type="button" class="btn-creativo-heart is-failed" data-cola-id="${item.id}" title="Falló; el canal quedó reservado" disabled>⚠️</button>`;
  }
  const liked = s === "queued";
  const title = liked ? `En lista (#${ord}) · Click para quitar` : "Me gusta · Sumar a lista para publicar";
  return `<button type="button" class="btn-creativo-heart ${liked ? "is-liked" : ""}" data-cola-id="${item.id}" title="${title}" aria-label="${title}">${liked ? `❤️ #${ord}` : "🤍"}</button>`;
}

export function colaBadgeHtml(item) {
  const pub = getPublicationDetails(item.id);
  return pub ? `<span class="creativo-card-pub-badge ${pub.badgeClass}">✅ ${pub.channelText}</span>` : "";
}

export function colaButtonHtml(item) {
  const s = stateOf(item.id);
  const ord = orderOf(item.id);
  const pub = getPublicationDetails(item.id);
  if (pub) {
    return `<button type="button" class="btn btn-sm btn-creativo-cola is-published" data-cola-id="${item.id}" disabled title="Publicada el ${pub.date} (${pub.channelText})">✅ ${pub.channelText}</button>`;
  }
  if (s === "publishing") {
    return `<button type="button" class="btn btn-sm btn-creativo-cola is-publishing" data-cola-id="${item.id}" disabled>⏳ Publicando…</button>`;
  }
  if (s === "queued") {
    return `<button type="button" class="btn btn-sm btn-creativo-cola is-queued" data-cola-id="${item.id}" title="Publicación #${ord} en la cola. Click para quitar">❤️ Programada (#${ord})</button>`;
  }
  if (s === "failed") {
    return `<button type="button" class="btn btn-sm btn-creativo-cola is-failed" data-cola-id="${item.id}" disabled title="Falló; el canal quedó reservado">⚠️ Falló (bloqueada)</button>`;
  }
  return `<button type="button" class="btn btn-sm btn-creativo-cola is-none" data-cola-id="${item.id}" title="Sumar a la lista de publicaciones automáticas">🤍 Me gusta (programar)</button>`;
}

function paintEl(el) {
  const id = el.dataset.colaId;
  const s = stateOf(id);
  const ord = orderOf(id);
  const pub = getPublicationDetails(id);
  const isHeart = el.classList.contains("btn-creativo-heart");
  if (isHeart) {
    if (pub) {
      el.className = "btn-creativo-heart is-published";
      el.textContent = "✅";
      el.title = `Publicada el ${pub.date} (${pub.channelText})`;
      el.disabled = true;
    } else if (s === "publishing" || s === "failed") {
      el.className = `btn-creativo-heart is-${s}`;
      el.textContent = s === "publishing" ? "⏳" : "⚠️";
      el.title = s === "publishing" ? "Publicación en curso" : "Falló; el canal quedó reservado";
      el.disabled = true;
    } else {
      const liked = s === "queued";
      el.className = `btn-creativo-heart ${liked ? "is-liked" : ""}`;
      el.textContent = liked ? `❤️ #${ord}` : "🤍";
      el.title = liked ? `En lista (#${ord}) · Click para quitar` : "Me gusta · Sumar a lista para publicar";
      el.disabled = false;
    }
    return;
  }
  if (!el.classList.contains("btn-creativo-cola")) return;
  el.className = `btn btn-sm btn-creativo-cola is-${s === "none" ? "none" : s}`;
  if (pub) {
    el.textContent = `✅ ${pub.channelText}`;
    el.title = `Publicada el ${pub.date} (${pub.channelText})`;
    el.disabled = true;
  } else if (s === "publishing") {
    el.textContent = "⏳ Publicando…";
    el.disabled = true;
  } else if (s === "queued") {
    el.textContent = `❤️ Programada (#${ord})`;
    el.title = `Publicación #${ord} en la cola. Click para quitar`;
    el.disabled = false;
  } else if (s === "failed") {
    el.textContent = "⚠️ Falló (bloqueada)";
    el.disabled = true;
  } else {
    el.textContent = "🤍 Me gusta (programar)";
    el.disabled = false;
  }
}

export function refreshColaButtons() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("[data-cola-id]").forEach(paintEl);
  const badge = document.getElementById("creativos-queue-badge");
  if (badge) badge.textContent = String(getQueuedItems().length);
}

let painted = false;
export function ensureColaUiPaint() {
  if (painted) return;
  painted = true;
  subscribeCola(refreshColaButtons);
}
