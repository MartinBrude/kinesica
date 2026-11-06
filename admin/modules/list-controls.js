/**
 * Bloqueo de búsqueda/filtros mientras un listado está cargando.
 */

const CONTROL_SELECTOR = [
  'input[type="search"]',
  'input[type="text"]',
  "select",
  "button[data-filter]",
  ".filter-pill",
  ".encuestas-filter-btn",
  ".admin-errores-filter-btn",
].join(", ");

function normalizeRoots(root) {
  if (!root) return [];
  if (typeof root === "string") {
    return Array.from(document.querySelectorAll(root));
  }
  const isNodeList = typeof globalThis.NodeList !== "undefined" && root instanceof globalThis.NodeList;
  const isHtmlCollection = typeof globalThis.HTMLCollection !== "undefined" && root instanceof globalThis.HTMLCollection;
  if (Array.isArray(root) || isNodeList || isHtmlCollection) {
    return Array.from(root).filter(Boolean);
  }
  return [root];
}

/**
 * Habilita o bloquea controles de filtro/búsqueda de un listado.
 * @param {ParentNode|Element|Element[]|NodeList|string|null} root Contenedor(es) del toolbar
 * @param {boolean} enabled true = se puede buscar/filtrar
 * @param {{ extra?: Array<Element|null|undefined> }} [opts]
 */
export function setListControlsEnabled(root, enabled, opts = {}) {
  const roots = normalizeRoots(root);
  const nodes = new Set();

  for (const r of roots) {
    if (!r || typeof r.querySelectorAll !== "function") continue;
    r.classList.toggle("list-controls-locked", !enabled);
    if (typeof globalThis.Element !== "undefined" && r instanceof globalThis.Element) {
      r.setAttribute("aria-busy", enabled ? "false" : "true");
    }
    r.querySelectorAll(CONTROL_SELECTOR).forEach((el) => nodes.add(el));
  }

  for (const el of opts.extra || []) {
    if (el) nodes.add(el);
  }

  for (const el of nodes) {
    // Acciones de carga/alta se gestionan aparte.
    if (el.id && /^(btn-refresh-|btn-nuevo-|admin-btn-nuevo-)/.test(el.id)) continue;
    el.disabled = !enabled;
    if (!enabled) el.setAttribute("aria-disabled", "true");
    else el.removeAttribute("aria-disabled");
  }
}
