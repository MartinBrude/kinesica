/**
 * Kinésica Admin — Modal de creación de tareas pendientes
 */

import { api } from "./api.js?v=79";
import { dialogAlert, toast } from "./dom.js?v=79";

const modal = document.querySelector("#admin-pendiente-modal");
const form = document.querySelector("#admin-pendiente-form");
const inputTitulo = document.querySelector("#admin-pendiente-titulo");
const selectPosicion = document.querySelector("#admin-pendiente-posicion");
const btnSave = document.querySelector("#admin-pendiente-modal-save");

export function openPendienteModal() {
  if (!modal) return;
  if (form) form.reset();
  modal.hidden = false;
  queueMicrotask(() => inputTitulo?.focus());
}

export function closePendienteModal() {
  if (!modal) return;
  modal.hidden = true;
  if (form) form.reset();
}

export function isPendienteModalOpen() {
  return Boolean(modal && !modal.hidden);
}

function setSaveDisabled(disabled) {
  if (btnSave) btnSave.disabled = Boolean(disabled);
}

export async function handleSavePendiente(e, { onSuccess, onReload }) {
  if (e) e.preventDefault();
  const titulo = String(inputTitulo?.value || "").trim();
  const posicion = String(selectPosicion?.value || "bottom");
  if (!titulo) {
    dialogAlert("Escribí el título de la tarea.");
    inputTitulo?.focus();
    return;
  }
  if (titulo.length > 255) {
    dialogAlert("El título no puede superar los 255 caracteres.");
    inputTitulo?.focus();
    return;
  }

  setSaveDisabled(true);
  try {
    const resp = await api("pendientes.php", {
      method: "POST",
      body: JSON.stringify({ action: "create", titulo, posicion }),
    });
    toast("Pendiente agregado.", { type: "success" });
    closePendienteModal();
    if (typeof onSuccess === "function") {
      await onSuccess(resp);
    }
    if (typeof onReload === "function") await onReload();
  } catch (err) {
    dialogAlert("Error al agregar pendiente: " + (err.message || "Error desconocido"));
  } finally {
    setSaveDisabled(false);
  }
}

export function initPendienteModalListeners({ onSubmit }) {
  const btnNuevo = document.querySelector("#admin-btn-nuevo-pendiente");
  btnNuevo?.addEventListener("click", openPendienteModal);
  document.getElementById("admin-pendiente-modal-close")?.addEventListener("click", closePendienteModal);
  document.getElementById("admin-pendiente-modal-cancel")?.addEventListener("click", closePendienteModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closePendienteModal();
  });
  form?.addEventListener("submit", onSubmit);
}
