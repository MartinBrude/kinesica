/**
 * Kinésica Admin - Gestión de Gastos e Inversiones Operativas
 * Registro de costos en EUR, USD y ARS con cotización histórica del día.
 */

import { api } from "./api.js?v=77";
import { escapeHtml, dialogAlert, dialogConfirm } from "./dom.js?v=78";
import { SEED_GASTOS, formatMoney, getRecordDailyAmounts } from "./admin-gastos-rates.js";
import {
  openCreateGastoModal,
  openEditGastoModal,
  closeGastoModal,
  isGastoModalOpen,
  getCurrentEditingGasto,
  getGastoFormPayload,
  setGastoSaveButtonDisabled,
  bindGastoModalEvents,
} from "./admin-gastos-modal.js";

export { SEED_GASTOS, formatMoney, isGastoModalOpen, closeGastoModal };

let cachedGastos = [];

const gastosTableBody = document.querySelector("#admin-gastos-tbody");
const gastosTotalEur = document.querySelector("#admin-gastos-total-eur");
const gastosTotalUsd = document.querySelector("#admin-gastos-total-usd");
const gastosTotalArs = document.querySelector("#admin-gastos-total-ars");
const gastosCountLabel = document.querySelector("#admin-gastos-count-label");
const gastosTfootEur = document.querySelector("#admin-gastos-tfoot-eur");
const gastosTfootUsd = document.querySelector("#admin-gastos-tfoot-usd");
const gastosTfootArs = document.querySelector("#admin-gastos-tfoot-ars");
const btnNuevoGasto = document.querySelector("#admin-btn-nuevo-gasto");

export function renderGastos(gastos, onReload) {
  let totalEur = 0; let totalUsd = 0; let totalArs = 0;
  for (const g of gastos) {
    const { eur, usd, ars } = getRecordDailyAmounts(g);
    totalEur += eur; totalUsd += usd; totalArs += ars;
  }
  if (gastosTotalEur) gastosTotalEur.textContent = formatMoney(totalEur, "EUR");
  if (gastosTotalUsd) gastosTotalUsd.textContent = formatMoney(totalUsd, "USD");
  if (gastosTotalArs) gastosTotalArs.textContent = formatMoney(totalArs, "ARS");
  if (gastosCountLabel) gastosCountLabel.textContent = `${gastos.length} gasto${gastos.length === 1 ? "" : "s"} registrado${gastos.length === 1 ? "" : "s"}`;
  if (gastosTfootEur) gastosTfootEur.textContent = formatMoney(totalEur, "EUR");
  if (gastosTfootUsd) gastosTfootUsd.textContent = formatMoney(totalUsd, "USD");
  if (gastosTfootArs) gastosTfootArs.textContent = formatMoney(totalArs, "ARS");

  if (!gastosTableBody) return;
  if (gastos.length === 0) {
    gastosTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:28px 16px;">No hay gastos registrados todavía.</td></tr>';
    return;
  }
  gastosTableBody.replaceChildren(...gastos.map((gasto) => {
    const tr = document.createElement("tr");
    const mon = (gasto.moneda || "EUR").toUpperCase();
    const { eur, usd, ars, tcEurUsd, tcEurArs } = getRecordDailyAmounts(gasto);

    const tdConcepto = document.createElement("td");
    tdConcepto.innerHTML = `<strong>${escapeHtml(gasto.concepto)}</strong>${gasto.detalle?.trim() ? `<div class="gasto-detalle-sub">${escapeHtml(gasto.detalle.trim())}</div>` : ""}`;

    const tdFecha = document.createElement("td");
    tdFecha.innerHTML = `${escapeHtml(gasto.fecha || "—")}<span class="gasto-tc-sub">Pagado en ${mon}</span>`;

    const tdEur = document.createElement("td");
    tdEur.className = "num-col";
    tdEur.innerHTML = `${formatMoney(eur, "EUR")}${mon === "EUR" ? '<span class="gasto-orig-badge">Original</span>' : `<span class="gasto-tc-sub">Cambio del ${gasto.fecha}</span>`}`;

    const tdUsd = document.createElement("td");
    tdUsd.className = "num-col";
    tdUsd.innerHTML = `${formatMoney(usd, "USD")}${mon === "USD" ? '<span class="gasto-orig-badge">Original</span>' : `<span class="gasto-tc-sub">TC día: ${tcEurUsd.toLocaleString("es-AR")} US$/€</span>`}`;

    const tdArs = document.createElement("td");
    tdArs.className = "num-col";
    tdArs.innerHTML = `${formatMoney(ars, "ARS")}${mon === "ARS" ? '<span class="gasto-orig-badge">Original</span>' : `<span class="gasto-tc-sub">TC día: $ ${tcEurArs.toLocaleString("es-AR")}/€</span>`}`;

    const tdActions = document.createElement("td");
    tdActions.className = "prof-actions-td";
    const cell = document.createElement("div");
    cell.className = "prof-actions-cell";

    const btnEdit = document.createElement("button");
    btnEdit.type = "button"; btnEdit.className = "btn ghost btn-prof-edit"; btnEdit.textContent = "Editar";
    btnEdit.addEventListener("click", () => openEditGastoModal(gasto));
    cell.appendChild(btnEdit);

    const btnDelete = document.createElement("button");
    btnDelete.type = "button"; btnDelete.className = "btn ghost btn-prof-toggle btn-gasto-delete"; btnDelete.textContent = "Eliminar";
    btnDelete.addEventListener("click", () => handleDeleteGasto(gasto, onReload));
    cell.appendChild(btnDelete);

    tdActions.appendChild(cell);
    tr.append(tdConcepto, tdFecha, tdEur, tdUsd, tdArs, tdActions);
    return tr;
  }));
}

export async function handleSaveGasto(e, onReload) {
  if (e) e.preventDefault();
  const payloadFields = getGastoFormPayload();
  if (!payloadFields) {
    dialogAlert("Verificá que el concepto, la fecha, y los montos en las 3 monedas sean válidos y mayores a 0.");
    return;
  }
  const currentEditingGasto = getCurrentEditingGasto();
  setGastoSaveButtonDisabled(true);
  try {
    if (currentEditingGasto) {
      await api("gastos.php", { method: "POST", body: JSON.stringify({ action: "update", id: currentEditingGasto.id, ...payloadFields }) }).catch(() => {
        const idx = cachedGastos.findIndex((g) => g.id === currentEditingGasto.id);
        if (idx !== -1) cachedGastos[idx] = { ...cachedGastos[idx], ...payloadFields };
      });
      dialogAlert("Gasto actualizado con sus equivalencias del día.");
    } else {
      await api("gastos.php", { method: "POST", body: JSON.stringify({ action: "create", ...payloadFields }) }).catch(() => {
        cachedGastos.unshift({ id: "gasto_" + Date.now(), ...payloadFields });
      });
      dialogAlert("Gasto registrado con sus equivalencias del día.");
    }
    closeGastoModal();
    if (typeof onReload === "function") await onReload();
  } catch (err) {
    dialogAlert("Error al guardar gasto: " + (err.message || "Error desconocido"));
  } finally {
    setGastoSaveButtonDisabled(false);
  }
}

export async function handleDeleteGasto(gasto, onReload) {
  const ok = await dialogConfirm(`¿Estás seguro de eliminar el gasto "${escapeHtml(gasto.concepto)}"?`);
  if (!ok) return;
  try {
    await api("gastos.php", { method: "POST", body: JSON.stringify({ action: "delete", id: gasto.id }) }).catch(() => {
      cachedGastos = cachedGastos.filter((g) => g.id !== gasto.id);
    });
    dialogAlert("Gasto eliminado exitosamente.");
    if (typeof onReload === "function") await onReload();
  } catch (err) {
    dialogAlert("Error al eliminar gasto: " + (err.message || "Error desconocido"));
  }
}

export async function loadGastosData(onReload) {
  try {
    const data = await api("gastos.php");
    if (data && Array.isArray(data.gastos)) cachedGastos = data.gastos;
    else if (!cachedGastos.length) cachedGastos = [...SEED_GASTOS];
  } catch (_) {
    if (!cachedGastos.length) cachedGastos = [...SEED_GASTOS];
  }
  renderGastos(cachedGastos, onReload);
}

export function initGastosUI({ onReload }) {
  btnNuevoGasto?.addEventListener("click", openCreateGastoModal);
  bindGastoModalEvents({
    onSaveSubmit: (e) => handleSaveGasto(e, onReload),
  });
}
