/** Estado del módulo de encuestas. */

let cachedEncuestas = [];
let currentFilter = "todas";
let encuestasLoading = false;

export function getCachedEncuestas() { return cachedEncuestas; }
export function setCachedEncuestas(list) { cachedEncuestas = Array.isArray(list) ? list : []; }
export function getEncuestasFilter() { return currentFilter; }
export function setEncuestasFilterState(filter) { currentFilter = filter || "todas"; }
export function getEncuestasLoading() { return encuestasLoading; }
export function setEncuestasLoading(value) { encuestasLoading = Boolean(value); }
