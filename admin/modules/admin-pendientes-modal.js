/**
 * Kinésica Admin — Modal de creación y edición de tareas pendientes
 */

import { api } from "./api.js?v=79";
import { dialogAlert, toast } from "./dom.js?v=79";

const modal = document.querySelector("#admin-pendiente-modal");
const modalTitle = document.querySelector("#admin-pendiente-modal-title");
const form = document.querySelector("#admin-pendiente-form");
const inputTitulo = document.querySelector("#admin-pendiente-titulo");
const selectPosicion = document.querySelector("#admin-pendiente-posicion");
const posicionGroup = document.querySelector("#admin-pendiente-posicion-group");
const btnSave = document.querySelector("#admin-pendiente-modal-save");

let editingId = null;

export function openPendienteModal() {
  if (!modal) return;
  editingId = null;
  if (form) form.reset();
  if (modalTitle) modalTitle.textContent = "Nuevo pendiente";
  if (btnSave) btnSave.textContent = "Agregar";
  if (posicionGroup) posicionGroup.hidden = false;
  modal.hidden = false;
  queueMicrotask(() => inputTitulo?.focus());
}

export function openEditPendienteModal(item) {
  if (!modal || !item?.id) return;
  editingId = String(item.id);
  if (form) form.reset();
  if (modalTitle) modalTitle.textContent = "Editar pendiente";
  if (btnSave) btnSave.textContent = "Guardar";
  if (posicionGroup) posicionGroup.hidden = true;
  if (inputTitulo) inputTitulo.value = String(item.titulo || "");
  modal.hidden = false;
  queueMicrotask(() => {
    inputTitulo?.focus();
    inputTitulo?.select();
  });
}

export function closePendienteModal() {
  if (!modal) return;
  editingId = null;
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

  const isEdit = Boolean(editingId);
  const payload = isEdit
    ? { action: "update", id: editingId, titulo }
    : { action: "create", titulo, posicion };

  setSaveDisabled(true);
  try {
    const resp = await api("pendientes.php", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    toast(isEdit ? "Pendiente actualizado." : "Pendiente agregado.", { type: "success" });
    closePendienteModal();
    if (typeof onSuccess === "function") {
      await onSuccess(resp, { mode: isEdit ? "edit" : "create" });
    }
    if (typeof onReload === "function") await onReload();
  } catch (err) {
    const prefix = isEdit ? "Error al actualizar pendiente: " : "Error al agregar pendiente: ";
    dialogAlert(prefix + (err.message || "Error desconocido"));
  } finally {
    setSaveDisabled(false);
  }
}

export function initPendienteModalListeners({ onSubmit }) {
  const btnNuevo = document.querySelector("#admin-btn-nuevo-pendiente");
  btnNuevo?.addEventListener("click", () => openPendienteModal());
  document.getElementById("admin-pendiente-modal-close")?.addEventListener("click", closePendienteModal);
  document.getElementById("admin-pendiente-modal-cancel")?.addEventListener("click", closePendienteModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closePendienteModal();
  });
  form?.addEventListener("submit", onSubmit);
}
