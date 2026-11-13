import { api } from "./api.js?v=79";
import { dialogAlert, dialogConfirm, toast } from "./dom.js?v=79";
import {
  closeGastoModal,
  getCurrentEditingGasto,
  getGastoFormPayload,
  setGastoSaveButtonDisabled,
} from "./admin-gastos-modal.js";

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
      await api("gastos.php", { method: "POST", body: JSON.stringify({ action: "update", id: currentEditingGasto.id, ...payloadFields }) });
      toast("Gasto actualizado con sus equivalencias del día.", { type: "success" });
    } else {
      await api("gastos.php", { method: "POST", body: JSON.stringify({ action: "create", ...payloadFields }) });
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
  const ok = await dialogConfirm(`¿Estás seguro de eliminar el gasto "${gasto.concepto}"?`);
  if (!ok) return;
  try {
    await api("gastos.php", { method: "POST", body: JSON.stringify({ action: "delete", id: gasto.id }) });
    toast("Gasto eliminado.", { type: "success" });
    if (typeof onReload === "function") await onReload();
  } catch (err) {
    dialogAlert("Error al eliminar gasto: " + (err.message || "Error desconocido"), { type: "danger" });
  }
}
