/**
 * Referencias DOM y estado del formulario de ficha.
 */

export const form = document.querySelector("#ficha");
export const evaInput = form ? form.elements.eva : null;
export const compareFormBtn = document.querySelector("#btn-compare-form");
export const btnPdfHistory = document.querySelector("#btn-pdf-history");
export const btnBack = document.querySelector("#btn-back");
export const btnPrev = document.querySelector("#btn-prev");
export const btnNext = document.querySelector("#btn-next");

export const singles = {};
export let currentId = null;
export let formBaseline = "";
export let activeSessionUserGetter = null;
export let currentAllFichas = [];
