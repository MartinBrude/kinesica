const VIEW_PREF_KEY = "kinesica_admin_gastos_view";

let cachedGastos = [];
let sortFecha = "desc";
let groupByTipo = false;
let reloadHandler = null;

export const gastosTableBody = document.querySelector("#admin-gastos-tbody");
export const gastosTotalEur = document.querySelector("#admin-gastos-total-eur");
export const gastosTotalUsd = document.querySelector("#admin-gastos-total-usd");
export const gastosTotalArs = document.querySelector("#admin-gastos-total-ars");
export const gastosCountLabel = document.querySelector("#admin-gastos-count-label");
export const gastosTfootEur = document.querySelector("#admin-gastos-tfoot-eur");
export const gastosTfootUsd = document.querySelector("#admin-gastos-tfoot-usd");
export const gastosTfootArs = document.querySelector("#admin-gastos-tfoot-ars");
export const btnNuevoGasto = document.querySelector("#admin-btn-nuevo-gasto");
export const btnSortFecha = document.querySelector("#admin-gastos-sort-fecha");
export const btnGroupToggle = document.querySelector("#admin-gastos-group-toggle");
export const btnThFecha = document.querySelector("#admin-gastos-th-fecha");

export function getCachedGastos() { return cachedGastos; }
export function setCachedGastos(list) { cachedGastos = Array.isArray(list) ? list : []; }

export function getSortFecha() { return sortFecha; }
export function setSortFecha(value) { sortFecha = value; }

export function getGroupByTipo() { return groupByTipo; }
export function setGroupByTipo(value) { groupByTipo = Boolean(value); }

export function getReloadHandler() { return reloadHandler; }
export function setReloadHandler(fn) { reloadHandler = fn; }

export function loadViewPrefs() {
  try {
    const raw = sessionStorage.getItem(VIEW_PREF_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.sortFecha === "asc" || parsed?.sortFecha === "desc") sortFecha = parsed.sortFecha;
    groupByTipo = !!parsed?.groupByTipo;
  } catch (_) {
    /* ignore */
  }
}

export function saveViewPrefs() {
  try {
    sessionStorage.setItem(VIEW_PREF_KEY, JSON.stringify({ sortFecha, groupByTipo }));
  } catch (_) {
    /* ignore */
  }
}
