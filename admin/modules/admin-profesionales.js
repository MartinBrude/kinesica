/**
 * Kinésica Admin - Gestión de Profesionales del Equipo
 * Altas, bajas lógicas, edición de datos, roles (admin/profesional) y reenvío de accesos.
 */

import { api } from "./api.js?v=77";
import { escapeHtml, dialogAlert, dialogConfirm } from "./dom.js?v=78";

const profTableBody = document.querySelector("#admin-prof-tbody");
const btnNuevoProf = document.querySelector("#admin-btn-nuevo-prof");
const modalEl = document.querySelector("#admin-prof-modal");
const modalTitle = document.querySelector("#admin-prof-modal-title");
const formEl = document.querySelector("#admin-prof-form");
const inputUsername = document.querySelector("#admin-prof-username");
const inputFirstName = document.querySelector("#admin-prof-firstname");
const inputLastName = document.querySelector("#admin-prof-lastname");
const inputEmail = document.querySelector("#admin-prof-email");
const inputTelefono = document.querySelector("#admin-prof-telefono");
const selectRole = document.querySelector("#admin-prof-role");
const btnCloseModal = document.querySelector("#admin-prof-modal-close");
const btnCancelModal = document.querySelector("#admin-prof-modal-cancel");
const btnSaveModal = document.querySelector("#admin-prof-modal-save");

let currentEditingUser = null;
let cachedProfesionales = [];

export function isProfModalOpen() {
  return modalEl && !modalEl.hidden;
}

export function closeProfModal() {
  if (modalEl) modalEl.hidden = true;
  currentEditingUser = null;
}

export function openCreateModal() {
  currentEditingUser = null;
  if (modalTitle) modalTitle.textContent = "Nuevo Profesional";
  if (inputUsername) {
    inputUsername.value = "";
    inputUsername.parentElement.hidden = true;
  }
  if (inputFirstName) inputFirstName.value = "";
  if (inputLastName) inputLastName.value = "";
  if (inputEmail) inputEmail.value = "";
  if (inputTelefono) inputTelefono.value = "";
  if (selectRole) selectRole.value = "professional";

  if (modalEl) modalEl.hidden = false;
  inputFirstName?.focus();
}

export function openEditModal(prof) {
  currentEditingUser = prof;
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
    selectRole.disabled = prof.username === "martin";
  }

  if (modalEl) modalEl.hidden = false;
  inputFirstName?.focus();
}

export async function handleSaveProfessional(e, onReload) {
  if (e) e.preventDefault();
  const firstName = inputFirstName?.value?.trim() || "";
  const lastName = inputLastName?.value?.trim() || "";
  const email = inputEmail?.value?.trim() || "";
  const telefono = inputTelefono?.value?.trim() || "";
  const role = selectRole?.value || "professional";

  if (!firstName || !lastName) {
    dialogAlert("Completá el Nombre y el Apellido.");
    return;
  }
  if (!email || !email.includes("@")) {
    dialogAlert("Ingresá un correo electrónico válido.");
    return;
  }

  if (btnSaveModal) btnSaveModal.disabled = true;
  try {
    if (currentEditingUser) {
      const res = await api("profesionales.php", {
        method: "POST",
        body: JSON.stringify({
          action: "update",
          username: currentEditingUser.username,
          first_name: firstName,
          last_name: lastName,
          email,
          telefono,
          role,
        }),
      });
      dialogAlert(res.message || "Profesional actualizado correctamente.");
    } else {
      const res = await api("profesionales.php", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          first_name: firstName,
          last_name: lastName,
          email,
          telefono,
          role,
        }),
      });
      dialogAlert(res.message || "Profesional dado de alta. Se envió el link a su correo.");
    }
    closeProfModal();
    if (typeof onReload === "function") await onReload();
  } catch (err) {
    dialogAlert("Error al guardar: " + (err.message || "Error desconocido"));
  } finally {
    if (btnSaveModal) btnSaveModal.disabled = false;
  }
}

export async function handleToggleActive(prof, onReload) {
  const isActivating = !prof.active;
  const msg = isActivating
    ? `¿Deseás reactivar la cuenta de ${escapeHtml(prof.name)}? Volverá a tener acceso y aparecerá en las turneras y notificaciones.`
    : `¿Estás seguro de dar de baja a ${escapeHtml(prof.name)}? La cuenta quedará suspendida (no podrá iniciar sesión ni se ofrecerá en reservas activas). Las historias clínicas existentes no se perderán.`;

  const ok = await dialogConfirm(msg);
  if (!ok) return;

  try {
    const res = await api("profesionales.php", {
      method: "POST",
      body: JSON.stringify({
        action: "toggle_active",
        username: prof.username,
      }),
    });
    dialogAlert(res.message || "Estado actualizado.");
    if (typeof onReload === "function") await onReload();
  } catch (err) {
    dialogAlert("Error al cambiar estado: " + (err.message || "Error desconocido"));
  }
}

export function renderProfesionales(profesionales, onReload) {
  if (!profTableBody) return;
  profTableBody.replaceChildren(
    ...profesionales.map((prof) => {
      const tr = document.createElement("tr");
      if (!prof.active) tr.className = "is-inactive";

      const tdName = document.createElement("td");
      const nameStrong = document.createElement("strong");
      nameStrong.textContent = prof.name || prof.display_name || prof.username;
      const userSub = document.createElement("div");
      userSub.style.fontSize = "12px";
      userSub.style.color = "var(--muted)";
      userSub.textContent = `@${prof.username}`;
      tdName.append(nameStrong, userSub);

      const tdEmail = document.createElement("td");
      tdEmail.textContent = prof.email || "—";

      const tdPhone = document.createElement("td");
      tdPhone.textContent = prof.telefono || "—";

      const tdRole = document.createElement("td");
      const roleBadge = document.createElement("span");
      let roleLabel = "Profesional";
      let roleClass = "professional";
      if (prof.role === "admin") {
        roleLabel = "Admin";
        roleClass = "admin";
      } else if (prof.role === "colaborador") {
        roleLabel = "Colaborador";
        roleClass = "colaborador";
      }
      roleBadge.className = `prof-role-badge ${roleClass}`;
      roleBadge.textContent = roleLabel;
      tdRole.append(roleBadge);

      const tdStatus = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = `prof-status-badge ${prof.active ? "active" : "inactive"}`;
      statusBadge.textContent = prof.active ? "Activo" : "Inactivo";
      tdStatus.append(statusBadge);

      const tdActions = document.createElement("td");
      tdActions.className = "prof-actions-td";
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "prof-actions-cell";

      const btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn ghost btn-prof-edit";
      btnEdit.textContent = "Editar";
      btnEdit.addEventListener("click", () => openEditModal(prof));
      actionsWrap.append(btnEdit);

      if (prof.username !== "martin") {
        const btnToggle = document.createElement("button");
        btnToggle.type = "button";
        btnToggle.className = `btn ${prof.active ? "ghost" : "green"} btn-prof-toggle`;
        btnToggle.style.color = prof.active ? "#dc2626" : "";
        btnToggle.textContent = prof.active ? "Dar de baja" : "Reactivar";
        btnToggle.addEventListener("click", () => handleToggleActive(prof, onReload));
        actionsWrap.append(btnToggle);
      } else {
        const spacer = document.createElement("span");
        spacer.className = "btn-prof-spacer";
        spacer.setAttribute("aria-hidden", "true");
        actionsWrap.append(spacer);
      }

      tdActions.append(actionsWrap);
      tr.append(tdName, tdEmail, tdPhone, tdRole, tdStatus, tdActions);
      return tr;
    })
  );
}

export async function loadProfesionalesData(onReload) {
  try {
    const data = await api("profesionales.php");
    const list = Array.isArray(data?.profesionales)
      ? data.profesionales
      : (Array.isArray(data?.users) ? data.users : null);
    if (!list) return;
    cachedProfesionales = list;
    renderProfesionales(cachedProfesionales, onReload);
  } catch (err) {
    dialogAlert("Error al cargar datos de administración: " + (err.message || "Error desconocido"));
  }
}

export function initProfesionalesUI({ onReload }) {
  btnNuevoProf?.addEventListener("click", openCreateModal);
  btnCloseModal?.addEventListener("click", closeProfModal);
  btnCancelModal?.addEventListener("click", closeProfModal);
  formEl?.addEventListener("submit", (e) => handleSaveProfessional(e, onReload));
  modalEl?.addEventListener("click", (e) => {
    if (e.target === modalEl) closeProfModal();
  });
}
