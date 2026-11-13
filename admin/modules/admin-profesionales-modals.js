import {
  modalEl,
  modalTitle,
  detailModalEl,
  inputUsername,
  inputFirstName,
  inputLastName,
  inputEmail,
  inputTelefono,
  selectRole,
  setCurrentEditingUser,
  setCurrentDetailUser,
  isSoleActiveAdmin,
} from "./admin-profesionales-state.js";

export function isProfModalOpen() {
  return (modalEl && !modalEl.hidden) || (detailModalEl && !detailModalEl.hidden);
}

export function closeProfModal() {
  if (modalEl) modalEl.hidden = true;
  if (detailModalEl) detailModalEl.hidden = true;
  setCurrentEditingUser(null);
  setCurrentDetailUser(null);
}

export function openCreateModal() {
  closeProfModal();
  setCurrentEditingUser(null);
  if (modalTitle) modalTitle.textContent = "Nuevo usuario";
  if (inputUsername) {
    inputUsername.value = "";
    inputUsername.parentElement.hidden = true;
  }
  if (inputFirstName) inputFirstName.value = "";
  if (inputLastName) inputLastName.value = "";
  if (inputEmail) inputEmail.value = "";
  if (inputTelefono) inputTelefono.value = "";
  if (selectRole) {
    selectRole.value = "professional";
    selectRole.disabled = false;
  }

  if (modalEl) modalEl.hidden = false;
  inputFirstName?.focus();
}

export function openEditModal(prof) {
  closeProfModal();
  setCurrentEditingUser(prof);
  if (modalTitle) modalTitle.textContent = `Editar a ${prof.name || prof.display_name || prof.username}`;
  if (inputUsername) {
    inputUsername.value = prof.username;
    inputUsername.parentElement.hidden = false;
  }
  if (inputFirstName) inputFirstName.value = prof.first_name || "";
  if (inputLastName) inputLastName.value = prof.last_name || "";
  if (inputEmail) inputEmail.value = prof.email || "";
  if (inputTelefono) inputTelefono.value = prof.telefono || "";
  if (selectRole) {
    selectRole.value = prof.role || "professional";
    // Solo bloquear democión si es el último admin activo (rol, no nombre).
    selectRole.disabled = isSoleActiveAdmin(prof);
  }

  if (modalEl) modalEl.hidden = false;
  inputFirstName?.focus();
}
