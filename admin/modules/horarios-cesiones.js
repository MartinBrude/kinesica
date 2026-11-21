/**
 * Kinésica Admin - Módulo de Cesión de Horarios y Cierres de Consultorio
 * Orquestador de estado, persistencia y sincronización con el motor de reservas.
 */

import { api } from "./api.js?v=79";
import { toast, dialogConfirm } from "./dom.js?v=79";
import { validateCesionDraft } from "./horarios-cesiones-validator.js";
import { renderCesionesForm, renderCesionesList } from "./horarios-cesiones-ui.js";

let currentOverrides = [];
let isInitialized = false;

function applyOverridesToRuntime(overrides) {
  if (typeof window !== "undefined" && window.KinesicaBookingEngine?.setScheduleOverrides) {
    window.KinesicaBookingEngine.setScheduleOverrides(overrides);
  }
  if (typeof window !== "undefined" && window.KinesicaBookingModal?.invalidateCache) {
    window.KinesicaBookingModal.invalidateCache();
  }
}

function renderListWithState() {
  const listContainer = document.querySelector("#horarios-cesiones-list-container");
  if (listContainer) {
    renderCesionesList({
      container: listContainer,
      overrides: currentOverrides,
      onAnular: handleAnularCesion,
      onDelete: handleDeleteCesion,
    });
  }
}

export async function loadCesionesFromServer() {
  try {
    const res = await api.get("/admin/api/horarios_cesiones.php");
    if (res && res.status === "success") {
      currentOverrides = Array.isArray(res.overrides) ? res.overrides : [];
      applyOverridesToRuntime(currentOverrides);
      renderListWithState();
    }
  } catch (err) {
    console.warn("[cesiones] error al cargar excepciones:", err);
  }
}

async function handleCreateCesion(draft) {
  const check = validateCesionDraft(draft);
  if (!check.isValid) {
    toast(check.errors[0] || "Por favor revisá los datos ingresados.", "error");
    return;
  }

  try {
    const res = await api.post("/admin/api/horarios_cesiones.php", {
      ...draft,
      action: "create",
    });

    if (res && res.status === "success") {
      toast("Cambio de horario registrado correctamente.", "success");
      currentOverrides = Array.isArray(res.overrides) ? res.overrides : [];
      applyOverridesToRuntime(currentOverrides);
      renderListWithState();

      const form = document.querySelector("#form-horarios-cesion");
      if (form) {
        const reasonInput = form.querySelector("#cesion-reason");
        if (reasonInput) reasonInput.value = "";
      }
    } else {
      toast(res?.message || "No se pudo registrar la excepción.", "error");
    }
  } catch (err) {
    toast(err?.message || "Error al conectar con el servidor.", "error");
  }
}

async function handleAnularCesion(id) {
  const ok = await dialogConfirm(
    "¿Confirmás anular este cambio de horario? Al anularlo, el consultorio recuperará de inmediato el cronograma semanal habitual para ese período."
  );
  if (!ok) return;

  try {
    const res = await api.post("/admin/api/horarios_cesiones.php", {
      action: "anular",
      id,
    });
    if (res && res.status === "success") {
      toast("Cambio de horario anulado correctamente.", "success");
      currentOverrides = Array.isArray(res.overrides) ? res.overrides : [];
      applyOverridesToRuntime(currentOverrides);
      renderListWithState();
    } else {
      toast(res?.message || "No se pudo anular la excepción.", "error");
    }
  } catch (err) {
    toast(err?.message || "Error de conexión al anular.", "error");
  }
}

async function handleDeleteCesion(id) {
  const ok = await dialogConfirm("¿Deseás eliminar permanentemente este registro del historial?");
  if (!ok) return;

  try {
    const res = await api.post("/admin/api/horarios_cesiones.php", {
      action: "delete",
      id,
    });
    if (res && res.status === "success") {
      toast("Registro eliminado del historial.", "success");
      currentOverrides = Array.isArray(res.overrides) ? res.overrides : [];
      applyOverridesToRuntime(currentOverrides);
      renderListWithState();
    } else {
      toast(res?.message || "No se pudo eliminar el registro.", "error");
    }
  } catch (err) {
    toast(err?.message || "Error de conexión al eliminar.", "error");
  }
}

async function handleCheckConflicts({ startDate, endDate, practitionerId }) {
  try {
    const q = new URLSearchParams({
      check_conflicts: "1",
      start_date: startDate,
      end_date: endDate,
      practitioner_id: practitionerId || "",
    });
    const res = await api.get(`/admin/api/horarios_cesiones.php?${q.toString()}`);
    return res && res.conflicts ? res.conflicts : [];
  } catch {
    return [];
  }
}

export function initCesionesModule() {
  const root = document.querySelector("#horarios-cesiones-container");
  if (!root || isInitialized) return;
  isInitialized = true;

  root.innerHTML = `
    <div id="horarios-cesiones-form-container"></div>
    <div id="horarios-cesiones-list-container"></div>
  `;

  const formContainer = root.querySelector("#horarios-cesiones-form-container");
  renderCesionesForm({
    container: formContainer,
    onSubmit: handleCreateCesion,
    onCheckConflicts: handleCheckConflicts,
  });

  loadCesionesFromServer();
}
