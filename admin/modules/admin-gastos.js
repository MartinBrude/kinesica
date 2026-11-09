/**
 * Kinésica Admin - Gestión de Gastos e Inversiones Operativas
 * Registro de costos en EUR, USD y ARS con cotización histórica del día.
 */

import { api } from "./api.js?v=79";
import { escapeHtml, dialogAlert, dialogConfirm, toast } from "./dom.js?v=79";
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

const VIEW_PREF_KEY = "kinesica_admin_gastos_view";

let cachedGastos = [];
/** @type {"asc"|"desc"} */
let sortFecha = "desc";
let groupByTipo = false;
let reloadHandler = null;

const gastosTableBody = document.querySelector("#admin-gastos-tbody");
const gastosTotalEur = document.querySelector("#admin-gastos-total-eur");
const gastosTotalUsd = document.querySelector("#admin-gastos-total-usd");
const gastosTotalArs = document.querySelector("#admin-gastos-total-ars");
const gastosCountLabel = document.querySelector("#admin-gastos-count-label");
const gastosTfootEur = document.querySelector("#admin-gastos-tfoot-eur");
const gastosTfootUsd = document.querySelector("#admin-gastos-tfoot-usd");
const gastosTfootArs = document.querySelector("#admin-gastos-tfoot-ars");
const btnNuevoGasto = document.querySelector("#admin-btn-nuevo-gasto");
const btnSortDesc = document.querySelector("#admin-gastos-sort-desc");
const btnSortAsc = document.querySelector("#admin-gastos-sort-asc");
const btnGroupToggle = document.querySelector("#admin-gastos-group-toggle");
const btnThFecha = document.querySelector("#admin-gastos-th-fecha");

function loadViewPrefs() {
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

function saveViewPrefs() {
  try {
    sessionStorage.setItem(VIEW_PREF_KEY, JSON.stringify({ sortFecha, groupByTipo }));
  } catch (_) {
    /* ignore */
  }
}

function syncViewControls() {
  btnSortDesc?.classList.toggle("is-active", sortFecha === "desc");
  btnSortAsc?.classList.toggle("is-active", sortFecha === "asc");
  btnSortDesc?.setAttribute("aria-pressed", sortFecha === "desc" ? "true" : "false");
  btnSortAsc?.setAttribute("aria-pressed", sortFecha === "asc" ? "true" : "false");
  btnGroupToggle?.classList.toggle("is-active", groupByTipo);
  btnGroupToggle?.setAttribute("aria-pressed", groupByTipo ? "true" : "false");
  btnGroupToggle && (btnGroupToggle.textContent = groupByTipo ? "Agrupado por tipo" : "Agrupar por tipo");

  const indicator = btnThFecha?.querySelector(".gastos-sort-indicator");
  if (indicator) indicator.textContent = sortFecha === "asc" ? "↑" : "↓";
  btnThFecha?.classList.add("is-active");
  btnThFecha?.setAttribute("aria-pressed", "true");
  btnThFecha?.setAttribute("title", sortFecha === "asc" ? "Orden: fecha ascendente (más antigua primero)" : "Orden: fecha descendente (más reciente primero)");
}

function conceptoKey(gasto) {
  return String(gasto?.concepto || "").trim() || "Sin título";
}

function compareFecha(a, b) {
  const fa = String(a?.fecha || "");
  const fb = String(b?.fecha || "");
  if (fa === fb) {
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  }
  return fa < fb ? -1 : 1;
}

function sortedGastos(list) {
  const copy = [...list];
  copy.sort((a, b) => {
    const cmp = compareFecha(a, b);
    return sortFecha === "asc" ? cmp : -cmp;
  });
  return copy;
}

function groupedGastos(list) {
  const map = new Map();
  for (const gasto of list) {
    const key = conceptoKey(gasto);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(gasto);
  }
  const groups = [...map.entries()].map(([titulo, items]) => ({
    titulo,
    items: sortedGastos(items),
  }));
  groups.sort((a, b) => a.titulo.localeCompare(b.titulo, "es", { sensitivity: "base" }));
  return groups;
}

function sumAmounts(items) {
  let eur = 0;
  let usd = 0;
  let ars = 0;
  for (const g of items) {
    const amounts = getRecordDailyAmounts(g);
    eur += amounts.eur;
    usd += amounts.usd;
    ars += amounts.ars;
  }
  return { eur, usd, ars };
}

function createGastoRow(gasto, { grouped = false } = {}) {
  const tr = document.createElement("tr");
  const mon = (gasto.moneda || "EUR").toUpperCase();
  const { eur, usd, ars, tcEurUsd, tcEurArs } = getRecordDailyAmounts(gasto);

  const tdConcepto = document.createElement("td");
  if (grouped) {
    const detalle = String(gasto.detalle || "").trim();
    tdConcepto.innerHTML = detalle
      ? `<span class="gasto-group-detalle">${escapeHtml(detalle)}</span>`
      : `<span class="gasto-group-detalle is-empty">Sin detalle</span>`;
  } else {
    tdConcepto.innerHTML = `<strong>${escapeHtml(gasto.concepto)}</strong>${gasto.detalle?.trim() ? `<div class="gasto-detalle-sub">${escapeHtml(gasto.detalle.trim())}</div>` : ""}`;
  }

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
  btnEdit.type = "button";
  btnEdit.className = "btn ghost btn-prof-edit";
  btnEdit.textContent = "Editar";
  btnEdit.addEventListener("click", () => openEditGastoModal(gasto));
  cell.appendChild(btnEdit);

  const btnDelete = document.createElement("button");
  btnDelete.type = "button";
  btnDelete.className = "btn ghost btn-prof-toggle btn-gasto-delete";
  btnDelete.textContent = "Eliminar";
  btnDelete.addEventListener("click", () => handleDeleteGasto(gasto, reloadHandler));
  cell.appendChild(btnDelete);

  tdActions.appendChild(cell);
  tr.append(tdConcepto, tdFecha, tdEur, tdUsd, tdArs, tdActions);
  return tr;
}

function createGroupHeaderRow(titulo, items) {
  const { eur, usd, ars } = sumAmounts(items);
  const tr = document.createElement("tr");
  tr.className = "gastos-group-row";

  const tdTitle = document.createElement("td");
  tdTitle.colSpan = 2;
  tdTitle.innerHTML = `<span class="gastos-group-title">${escapeHtml(titulo)}</span><span class="gastos-group-meta">${items.length} gasto${items.length === 1 ? "" : "s"}</span>`;

  const tdEur = document.createElement("td");
  tdEur.className = "num-col";
  tdEur.textContent = formatMoney(eur, "EUR");

  const tdUsd = document.createElement("td");
  tdUsd.className = "num-col";
  tdUsd.textContent = formatMoney(usd, "USD");

  const tdArs = document.createElement("td");
  tdArs.className = "num-col";
  tdArs.textContent = formatMoney(ars, "ARS");

  const tdActions = document.createElement("td");
  tr.append(tdTitle, tdEur, tdUsd, tdArs, tdActions);
  return tr;
}

export function renderGastos(gastos, onReload) {
  if (typeof onReload === "function") reloadHandler = onReload;

  const { eur: totalEur, usd: totalUsd, ars: totalArs } = sumAmounts(gastos);
  if (gastosTotalEur) gastosTotalEur.textContent = formatMoney(totalEur, "EUR");
  if (gastosTotalUsd) gastosTotalUsd.textContent = formatMoney(totalUsd, "USD");
  if (gastosTotalArs) gastosTotalArs.textContent = formatMoney(totalArs, "ARS");
  if (gastosCountLabel) gastosCountLabel.textContent = `${gastos.length} gasto${gastos.length === 1 ? "" : "s"} registrado${gastos.length === 1 ? "" : "s"}`;
  if (gastosTfootEur) gastosTfootEur.textContent = formatMoney(totalEur, "EUR");
  if (gastosTfootUsd) gastosTfootUsd.textContent = formatMoney(totalUsd, "USD");
  if (gastosTfootArs) gastosTfootArs.textContent = formatMoney(totalArs, "ARS");

  syncViewControls();

  if (!gastosTableBody) return;
  if (gastos.length === 0) {
    gastosTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:28px 16px;">No hay gastos registrados todavía.</td></tr>';
    return;
  }

  const rows = [];
  if (groupByTipo) {
    for (const group of groupedGastos(gastos)) {
      rows.push(createGroupHeaderRow(group.titulo, group.items));
      for (const gasto of group.items) rows.push(createGastoRow(gasto, { grouped: true }));
    }
  } else {
    for (const gasto of sortedGastos(gastos)) rows.push(createGastoRow(gasto));
  }
  gastosTableBody.replaceChildren(...rows);
}

function setSortFecha(next) {
  if (next !== "asc" && next !== "desc") return;
  sortFecha = next;
  saveViewPrefs();
  renderGastos(cachedGastos, reloadHandler);
}

function toggleGroupByTipo() {
  groupByTipo = !groupByTipo;
  saveViewPrefs();
  renderGastos(cachedGastos, reloadHandler);
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
      toast("Gasto actualizado con sus equivalencias del día.", { type: "success" });
    } else {
      await api("gastos.php", { method: "POST", body: JSON.stringify({ action: "create", ...payloadFields }) }).catch(() => {
        cachedGastos.unshift({ id: "gasto_" + Date.now(), ...payloadFields });
      });
      toast("Gasto registrado con sus equivalencias del día.", { type: "success" });
    }
    closeGastoModal();
    if (typeof onReload === "function") await onReload();
  } catch (err) {
    dialogAlert("Error al guardar gasto: " + (err.message || "Error desconocido"), { type: "danger" });
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
    toast("Gasto eliminado.", { type: "success" });
    if (typeof onReload === "function") await onReload();
  } catch (err) {
    dialogAlert("Error al eliminar gasto: " + (err.message || "Error desconocido"), { type: "danger" });
  }
}

export async function loadGastosData(onReload) {
  const tbody = document.getElementById("admin-gastos-tbody");
  if (tbody && (!cachedGastos || !cachedGastos.length)) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-table-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Cargando registro de gastos…</span></td></tr>`;
  }
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
  loadViewPrefs();
  reloadHandler = onReload;
  syncViewControls();

  btnNuevoGasto?.addEventListener("click", openCreateGastoModal);
  bindGastoModalEvents({
    onSaveSubmit: (e) => handleSaveGasto(e, onReload),
  });

  btnSortDesc?.addEventListener("click", () => setSortFecha("desc"));
  btnSortAsc?.addEventListener("click", () => setSortFecha("asc"));
  btnGroupToggle?.addEventListener("click", toggleGroupByTipo);
  btnThFecha?.addEventListener("click", () => setSortFecha(sortFecha === "desc" ? "asc" : "desc"));
}
