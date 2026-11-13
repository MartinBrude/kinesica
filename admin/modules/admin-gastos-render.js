import { escapeHtml } from "./dom.js?v=79";
import { formatMoney, getRecordDailyAmounts } from "./admin-gastos-rates.js";
import { openEditGastoModal } from "./admin-gastos-modal.js";
import { handleDeleteGasto } from "./admin-gastos-actions.js";
import {
  getCachedGastos,
  getSortFecha,
  getGroupByTipo,
  getReloadHandler,
  gastosTableBody,
  gastosTotalEur,
  gastosTotalUsd,
  gastosTotalArs,
  gastosCountLabel,
  gastosTfootEur,
  gastosTfootUsd,
  gastosTfootArs,
  btnSortFecha,
  btnGroupToggle,
  btnThFecha,
  saveViewPrefs,
  setSortFecha,
  setGroupByTipo,
} from "./admin-gastos-state.js";

function syncViewControls() {
  const sortFecha = getSortFecha();
  const groupByTipo = getGroupByTipo();
  const arrow = sortFecha === "asc" ? "↑" : "↓";
  const sortTitle = sortFecha === "asc"
    ? "Orden: fecha ascendente (más antigua primero). Clic para invertir."
    : "Orden: fecha descendente (más reciente primero). Clic para invertir.";

  for (const btn of [btnSortFecha, btnThFecha]) {
    if (!btn) continue;
    const indicator = btn.querySelector(".gastos-sort-indicator");
    if (indicator) indicator.textContent = arrow;
    btn.classList.add("is-active");
    btn.setAttribute("aria-pressed", "true");
    btn.setAttribute("title", sortTitle);
  }

  btnGroupToggle?.classList.toggle("is-active", groupByTipo);
  btnGroupToggle?.setAttribute("aria-pressed", groupByTipo ? "true" : "false");
  if (btnGroupToggle) btnGroupToggle.textContent = groupByTipo ? "Agrupado por tipo" : "Agrupar por tipo";
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
  const sortFecha = getSortFecha();
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
  const reloadHandler = getReloadHandler();

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
  if (getGroupByTipo()) {
    for (const group of groupedGastos(gastos)) {
      rows.push(createGroupHeaderRow(group.titulo, group.items));
      for (const gasto of group.items) rows.push(createGastoRow(gasto, { grouped: true }));
    }
  } else {
    for (const gasto of sortedGastos(gastos)) rows.push(createGastoRow(gasto));
  }
  gastosTableBody.replaceChildren(...rows);
}

export function toggleSortFecha() {
  setSortFecha(getSortFecha() === "desc" ? "asc" : "desc");
  saveViewPrefs();
  renderGastos(getCachedGastos(), getReloadHandler());
}

export function toggleGroupByTipo() {
  setGroupByTipo(!getGroupByTipo());
  saveViewPrefs();
  renderGastos(getCachedGastos(), getReloadHandler());
}
