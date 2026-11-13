/**
 * Kinésica Admin — Render del grid de creativos Instagram.
 */

import { escapeHtml } from "./dom.js?v=79";
import {
  resolveImageText,
  assetVersion,
  isCreativoHidden,
  getHiddenIds,
} from "./admin-creativos-cola.js?v=12";
import {
  colaBadgeHtml,
  colaHeartHtml,
  refreshColaButtons,
} from "./admin-creativos-cola-ui.js?v=4";
import { imageTextEditButtonHtml } from "./admin-creativos-image-text.js?v=5";
import { CREATIVOS_DATA } from "./admin-creativos-data.js?v=1";
import {
  getActiveFormat,
  getActiveFilter,
  getSearchQuery,
} from "./admin-creativos-state.js?v=1";

export function renderCreativosGrid() {
  const grid = document.getElementById("admin-creativos-grid");
  const countLabel = document.getElementById("admin-creativos-count-label");
  if (!grid) return;

  const activeFilter = getActiveFilter();
  const activeFormat = getActiveFormat();
  const searchQuery = getSearchQuery();
  const inTrash = activeFilter === "papelera";
  const filtered = CREATIVOS_DATA.filter((item) => {
    const hidden = isCreativoHidden(item.id);
    if (inTrash) {
      if (!hidden) return false;
    } else if (hidden) {
      return false;
    }
    if (!inTrash && activeFilter !== "todos" && item.group !== activeFilter) {
      return false;
    }
    if (searchQuery) {
      const haystack = `${item.title} ${item.cat} ${item.body}`.toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }
    return true;
  });

  const visibleTotal = inTrash
    ? getHiddenIds().length
    : CREATIVOS_DATA.length - getHiddenIds().length;
  if (countLabel) {
    countLabel.textContent = inTrash
      ? `${filtered.length} en papelera`
      : `${filtered.length} de ${visibleTotal} piezas`;
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="creativos-empty">
        <p>${inTrash ? "La papelera está vacía." : "No se encontraron piezas que coincidan con la búsqueda."}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((item) => {
      const texts = resolveImageText(item.id, item);
      const rawImg = activeFormat === "story" ? item.storyUrl : item.feedUrl;
      const imgUrl = `${rawImg}?v=${assetVersion}`;
      const aspectClass = activeFormat === "story" ? "aspect-story" : "aspect-feed";
      const trashBtn = inTrash
        ? `<button type="button" class="btn-creativo-trash is-restore" data-trash-id="${item.id}" title="Restaurar al catálogo" aria-label="Restaurar">♻️</button>`
        : `<button type="button" class="btn-creativo-trash" data-trash-id="${item.id}" title="Eliminar del catálogo" aria-label="Eliminar">🗑️</button>`;

      return `
        <article class="creativo-card${inTrash ? " is-trashed" : ""}" data-id="${item.id}">
          <div class="creativo-thumb-box ${aspectClass}" data-id="${item.id}" title="Click para ver en grande">
            <img src="${imgUrl}" alt="${escapeHtml(texts.title)}" loading="lazy">
            <div class="creativo-thumb-overlay">
              <span class="btn light btn-sm">🔍 Ver en grande</span>
            </div>
            <span class="creativo-format-badge">${activeFormat === "story" ? "Story 9:16" : "Feed 4:5"}</span>
            ${colaBadgeHtml(item)}
            ${inTrash ? "" : colaHeartHtml(item)}
            ${trashBtn}
          </div>

          <div class="creativo-info">
            <span class="creativo-pill">${escapeHtml(texts.cat)}</span>
            <h3 class="creativo-title">${escapeHtml(texts.title)}</h3>
            <p class="creativo-desc">${escapeHtml(texts.body)}</p>

            <div class="creativo-actions">
              <a href="${item.feedUrl}?v=${assetVersion}" download="kinesica_feed_${item.id}.png" class="btn light btn-sm" title="Descargar imagen en formato Feed 4:5">
                📥 Feed (4:5)
              </a>
              <a href="${item.storyUrl}?v=${assetVersion}" download="kinesica_story_${item.id}.png" class="btn light btn-sm" title="Descargar imagen en formato Story 9:16">
                📥 Story (9:16)
              </a>
              <button type="button" class="btn light btn-sm btn-creativo-copy" data-id="${item.id}" title="Copiar caption">
                📋 Copiar caption
              </button>
              ${inTrash ? "" : imageTextEditButtonHtml(item.id)}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
  refreshColaButtons();
}
