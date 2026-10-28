/**
 * Kinésica Admin - Modal de Alta y Edición de Gastos
 * Formulario reactivo con recálculo dinámico en EUR / USD / ARS y búsqueda de TC por fecha.
 */

import { dialogAlert } from "./dom.js?v=78";
import {
  historicalRatesByDate,
  getRecordDailyAmounts,
  convertAmountByRates,
  fetchRatesForDateOnline,
} from "./admin-gastos-rates.js";

const modalGastoEl = document.querySelector("#admin-gasto-modal");
const modalGastoTitle = document.querySelector("#admin-gasto-modal-title");
const formGastoEl = document.querySelector("#admin-gasto-form");
const inputGastoId = document.querySelector("#admin-gasto-id");
const inputGastoConcepto = document.querySelector("#admin-gasto-concepto");
const inputGastoDetalle = document.querySelector("#admin-gasto-detalle");
const inputGastoFecha = document.querySelector("#admin-gasto-fecha");
const inputGastoMonto = document.querySelector("#admin-gasto-monto");
const selectGastoMoneda = document.querySelector("#admin-gasto-moneda");
const inputGastoMontoEur = document.querySelector("#admin-gasto-monto-eur");
const inputGastoMontoUsd = document.querySelector("#admin-gasto-monto-usd");
const inputGastoMontoArs = document.querySelector("#admin-gasto-monto-ars");
const btnFetchFechaTc = document.querySelector("#admin-btn-fetch-fecha-tc");
const statusGastoTc = document.querySelector("#admin-gasto-tc-status");
const btnCloseGastoModal = document.querySelector("#admin-gasto-modal-close");
const btnCancelGastoModal = document.querySelector("#admin-gasto-modal-cancel");
const btnSaveGastoModal = document.querySelector("#admin-gasto-modal-save");

let modalCurrentRates = { eurUsd: 1.082, eurArs: 1450.0 };
let currentEditingGasto = null;

export function getCurrentEditingGasto() {
  return currentEditingGasto;
}

export function isGastoModalOpen() {
  return modalGastoEl && !modalGastoEl.hidden;
}

export function closeGastoModal() {
  if (modalGastoEl) modalGastoEl.hidden = true;
  currentEditingGasto = null;
}

export function getGastoFormPayload() {
  const concepto = inputGastoConcepto?.value?.trim() || "";
  const detalle = inputGastoDetalle?.value?.trim() || "";
  const fecha = inputGastoFecha?.value?.trim() || "";
  const monto = parseFloat(inputGastoMonto?.value || "0");
  const moneda = (selectGastoMoneda?.value || "EUR").toUpperCase();
  const montoEur = parseFloat(inputGastoMontoEur?.value || "0");
  const montoUsd = parseFloat(inputGastoMontoUsd?.value || "0");
  const montoArs = parseFloat(inputGastoMontoArs?.value || "0");

  if (!concepto || !fecha || isNaN(monto) || monto <= 0 || !(montoEur > 0) || !(montoUsd > 0) || !(montoArs > 0)) {
    return null;
  }
  const tcEurUsd = Math.round((montoUsd / montoEur) * 10000) / 10000;
  const tcEurArs = Math.round((montoArs / montoEur) * 100) / 100;
  return { concepto, detalle, fecha, monto, moneda, monto_eur: montoEur, monto_usd: montoUsd, monto_ars: montoArs, tc_eur_usd: tcEurUsd, tc_eur_ars: tcEurArs };
}

export function setGastoSaveButtonDisabled(val) {
  if (btnSaveGastoModal) btnSaveGastoModal.disabled = Boolean(val);
}

export async function fetchRatesForDate(fecha, notify = false) {
  const cleanDate = (fecha || "").trim();
  if (historicalRatesByDate[cleanDate] && !notify) {
    modalCurrentRates = { ...historicalRatesByDate[cleanDate] };
    updateModalTcStatus(cleanDate, false);
    recalcModalCurrencies();
    return;
  }
  try {
    const fetched = await fetchRatesForDateOnline(cleanDate);
    if (fetched) {
      modalCurrentRates = fetched;
      if (cleanDate) historicalRatesByDate[cleanDate] = { ...fetched };
      updateModalTcStatus(cleanDate, true);
      recalcModalCurrencies();
      if (notify) dialogAlert(`Cotización del ${cleanDate || "día"} aplicada: 1 EUR = US$ ${fetched.eurUsd} | $ ${fetched.eurArs.toLocaleString("es-AR")} ARS.`);
      return;
    }
  } catch (_) {}
  if (cleanDate && historicalRatesByDate[cleanDate]) modalCurrentRates = { ...historicalRatesByDate[cleanDate] };
  updateModalTcStatus(cleanDate, false);
  recalcModalCurrencies();
  if (notify) dialogAlert("Se aplicó la cotización histórica de referencia para la fecha seleccionada.");
}

function updateModalTcStatus(fecha, fromOnline = false) {
  if (!statusGastoTc) return;
  const labelFecha = fecha || "la fecha seleccionada";
  const src = fromOnline ? "cotización histórica verificada" : "cotización registrada del día";
  statusGastoTc.textContent = `Cambio del ${labelFecha} (${src}): 1 EUR = US$ ${modalCurrentRates.eurUsd.toLocaleString("es-AR")} | $ ${modalCurrentRates.eurArs.toLocaleString("es-AR")} ARS.`;
}

export function recalcModalCurrencies() {
  const monto = parseFloat(inputGastoMonto?.value || "0");
  const mon = (selectGastoMoneda?.value || "EUR").toUpperCase();
  if (inputGastoMontoEur) inputGastoMontoEur.readOnly = mon === "EUR";
  if (inputGastoMontoUsd) inputGastoMontoUsd.readOnly = mon === "USD";
  if (inputGastoMontoArs) inputGastoMontoArs.readOnly = mon === "ARS";

  if (!(monto > 0)) {
    if (inputGastoMontoEur) inputGastoMontoEur.value = "";
    if (inputGastoMontoUsd) inputGastoMontoUsd.value = "";
    if (inputGastoMontoArs) inputGastoMontoArs.value = "";
    return;
  }
  const { eur, usd, ars } = convertAmountByRates(monto, mon, modalCurrentRates);
  if (inputGastoMontoEur) inputGastoMontoEur.value = eur.toFixed(2);
  if (inputGastoMontoUsd) inputGastoMontoUsd.value = usd.toFixed(2);
  if (inputGastoMontoArs) inputGastoMontoArs.value = ars.toFixed(2);
}

export function openCreateGastoModal() {
  currentEditingGasto = null;
  if (modalGastoTitle) modalGastoTitle.textContent = "Nuevo Gasto";
  if (inputGastoId) inputGastoId.value = "";
  if (inputGastoConcepto) inputGastoConcepto.value = "";
  if (inputGastoDetalle) inputGastoDetalle.value = "";
  const today = new Date().toISOString().split("T")[0];
  if (inputGastoFecha) inputGastoFecha.value = today;
  if (inputGastoMonto) inputGastoMonto.value = "";
  if (selectGastoMoneda) selectGastoMoneda.value = "EUR";
  if (inputGastoMontoEur) inputGastoMontoEur.value = "";
  if (inputGastoMontoUsd) inputGastoMontoUsd.value = "";
  if (inputGastoMontoArs) inputGastoMontoArs.value = "";
  fetchRatesForDate(today, false);
  if (modalGastoEl) modalGastoEl.hidden = false;
  inputGastoConcepto?.focus();
}

export function openEditGastoModal(gasto) {
  currentEditingGasto = gasto;
  if (modalGastoTitle) modalGastoTitle.textContent = "Editar Gasto";
  if (inputGastoId) inputGastoId.value = gasto.id || "";
  if (inputGastoConcepto) inputGastoConcepto.value = gasto.concepto || "";
  if (inputGastoDetalle) inputGastoDetalle.value = gasto.detalle || "";
  if (inputGastoFecha) inputGastoFecha.value = gasto.fecha || "";
  if (inputGastoMonto) inputGastoMonto.value = gasto.monto != null ? String(gasto.monto) : "";
  const mon = (gasto.moneda || "EUR").toUpperCase();
  if (selectGastoMoneda) selectGastoMoneda.value = mon;

  const { eur, usd, ars, tcEurUsd, tcEurArs } = getRecordDailyAmounts(gasto);
  modalCurrentRates = { eurUsd: tcEurUsd, eurArs: tcEurArs };
  updateModalTcStatus(gasto.fecha, false);

  if (inputGastoMontoEur) { inputGastoMontoEur.value = eur.toFixed(2); inputGastoMontoEur.readOnly = mon === "EUR"; }
  if (inputGastoMontoUsd) { inputGastoMontoUsd.value = usd.toFixed(2); inputGastoMontoUsd.readOnly = mon === "USD"; }
  if (inputGastoMontoArs) { inputGastoMontoArs.value = ars.toFixed(2); inputGastoMontoArs.readOnly = mon === "ARS"; }
  if (modalGastoEl) modalGastoEl.hidden = false;
  inputGastoConcepto?.focus();
}

export function bindGastoModalEvents({ onSaveSubmit }) {
  btnCloseGastoModal?.addEventListener("click", closeGastoModal);
  btnCancelGastoModal?.addEventListener("click", closeGastoModal);
  formGastoEl?.addEventListener("submit", onSaveSubmit);
  inputGastoMonto?.addEventListener("input", recalcModalCurrencies);
  selectGastoMoneda?.addEventListener("change", recalcModalCurrencies);
  inputGastoFecha?.addEventListener("change", (e) => fetchRatesForDate(e.target.value, false));
  btnFetchFechaTc?.addEventListener("click", () => fetchRatesForDate(inputGastoFecha?.value || "", true));
  modalGastoEl?.addEventListener("click", (e) => {
    if (e.target === modalGastoEl) closeGastoModal();
  });
}
