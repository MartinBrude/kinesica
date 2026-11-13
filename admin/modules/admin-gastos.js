/**
 * Kinésica Admin - Gestión de Gastos (facade).
 */

import { api } from "./api.js?v=79";
import { SEED_GASTOS, formatMoney } from "./admin-gastos-rates.js";
import {
  openCreateGastoModal,
  closeGastoModal,
  isGastoModalOpen,
  bindGastoModalEvents,
} from "./admin-gastos-modal.js";
import {
  getCachedGastos,
  setCachedGastos,
  setReloadHandler,
  loadViewPrefs,
  btnNuevoGasto,
  btnSortFecha,
  btnGroupToggle,
  btnThFecha,
} from "./admin-gastos-state.js";
import { renderGastos, toggleSortFecha, toggleGroupByTipo } from "./admin-gastos-render.js";
import { handleSaveGasto } from "./admin-gastos-actions.js";

export { SEED_GASTOS, formatMoney, isGastoModalOpen, closeGastoModal };

export { renderGastos, handleSaveGasto };
export { handleDeleteGasto } from "./admin-gastos-actions.js";

export async function loadGastosData(onReload) {
  const tbody = document.getElementById("admin-gastos-tbody");
  const cached = getCachedGastos();
  if (tbody && (!cached || !cached.length)) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-table-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Cargando registro de gastos…</span></td></tr>`;
  }
  try {
    const data = await api("gastos.php");
    if (data && Array.isArray(data.gastos)) setCachedGastos(data.gastos);
    else if (!getCachedGastos().length) setCachedGastos([...SEED_GASTOS]);
  } catch (_) {
    if (!getCachedGastos().length) setCachedGastos([...SEED_GASTOS]);
  }
  renderGastos(getCachedGastos(), onReload);
}

export function initGastosUI({ onReload }) {
  loadViewPrefs();
  setReloadHandler(onReload);
  renderGastos(getCachedGastos(), onReload);

  btnNuevoGasto?.addEventListener("click", openCreateGastoModal);
  bindGastoModalEvents({
    onSaveSubmit: (e) => handleSaveGasto(e, onReload),
  });

  btnSortFecha?.addEventListener("click", toggleSortFecha);
  btnGroupToggle?.addEventListener("click", toggleGroupByTipo);
  btnThFecha?.addEventListener("click", toggleSortFecha);
}
