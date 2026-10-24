/**
 * Kinésica Admin - Módulo de Administración ("Admin del Admin")
 * Exclusivo para usuarios con rol 'admin'.
 * Permite supervisar contadores de logins y gestionar el equipo de profesionales:
 * altas, bajas (desactivación lógica), edición de datos y reenvío de invitaciones.
 */

import { api } from "./api.js?v=77";
import { getSessionUser } from "./auth.js?v=80";
import { escapeHtml, dialogAlert, dialogConfirm } from "./dom.js?v=78";

const viewAdmin = document.querySelector("#view-admin");
const loginsContainer = document.querySelector("#admin-logins-container");
const profTableBody = document.querySelector("#admin-prof-tbody");
const btnNuevoProf = document.querySelector("#admin-btn-nuevo-prof");

// Modal de profesional
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

export function showAdminView() {
  const user = getSessionUser();
  if (!user || user.role !== "admin") {
    dialogAlert("Sección reservada exclusivamente a administradores.");
    return;
  }

  if (viewAdmin) {
    viewAdmin.hidden = false;
    const views = [
      "#view-dashboard",
      "#view-library",
      "#view-pacientes",
      "#view-consultorio",
      "#view-clara",
      "#view-configuracion",
      "#view-form",
      "#view-compare",
      "#view-gate",
    ];
    views.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.hidden = true;
    });

    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "admin" }));
    } catch {}

    loadAdminData();
  }
}

export function hideAdminView() {
  if (viewAdmin) {
    viewAdmin.hidden = true;
  }
}

export async function loadAdminData() {
  try {
    const data = await api("profesionales.php");
    if (!data || !Array.isArray(data.profesionales)) {
      return;
    }
    cachedProfesionales = data.profesionales;
    renderLogins(cachedProfesionales);
    renderProfesionales(cachedProfesionales);
  } catch (err) {
    dialogAlert("Error al cargar datos de administración: " + (err.message || "Error desconocido"));
  }
}

function renderLogins(profesionales) {
  if (!loginsContainer) return;
  loginsContainer.replaceChildren(
    ...profesionales.map((prof) => {
      const card = document.createElement("div");
      card.className = "login-stat-card";

      const name = document.createElement("span");
      name.className = "stat-name";
      name.textContent = prof.name || prof.username;

      const count = document.createElement("span");
      count.className = "stat-count";
      count.textContent = String(prof.login_count ?? 0);

      const role = document.createElement("span");
      role.className = "stat-role";
      role.textContent = prof.role === "admin" ? "Administrador" : "Profesional";

      card.append(name, count, role);
      return card;
    })
  );
}

function renderProfesionales(profesionales) {
  if (!profTableBody) return;
  profTableBody.replaceChildren(
    ...profesionales.map((prof) => {
      const tr = document.createElement("tr");
      if (!prof.active) {
        tr.className = "is-inactive";
      }

      // Nombre y usuario
      const tdName = document.createElement("td");
      const nameStrong = document.createElement("strong");
      nameStrong.textContent = prof.name;
      const userSub = document.createElement("div");
      userSub.style.fontSize = "12px";
      userSub.style.color = "var(--muted)";
      userSub.textContent = `@${prof.username}`;
      tdName.append(nameStrong, userSub);

      // Email
      const tdEmail = document.createElement("td");
      tdEmail.textContent = prof.email || "—";

      // Teléfono
      const tdPhone = document.createElement("td");
      tdPhone.textContent = prof.telefono || "—";

      // Rol
      const tdRole = document.createElement("td");
      const roleBadge = document.createElement("span");
      roleBadge.className = `prof-role-badge ${prof.role === "admin" ? "admin" : "professional"}`;
      roleBadge.textContent = prof.role === "admin" ? "Admin" : "Profesional";
      tdRole.append(roleBadge);

      // Estado
      const tdStatus = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = `prof-status-badge ${prof.active ? "active" : "inactive"}`;
      statusBadge.textContent = prof.active ? "Activo" : "Inactivo";
      tdStatus.append(statusBadge);

      // Acciones
      const tdActions = document.createElement("td");
      tdActions.className = "prof-actions-cell";

      // Botón Editar
      const btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn ghost";
      btnEdit.textContent = "Editar";
      btnEdit.addEventListener("click", () => openEditModal(prof));
      tdActions.append(btnEdit);

      // Botón Reenviar invitación (si está activo)
      if (prof.active) {
        const btnInvite = document.createElement("button");
        btnInvite.type = "button";
        btnInvite.className = "btn ghost";
        btnInvite.title = "Enviar enlace de contraseña al correo";
        btnInvite.textContent = "Reenviar link";
        btnInvite.addEventListener("click", () => handleResendInvite(prof));
        tdActions.append(btnInvite);
      }

      // Botón Dar de baja / Reactivar (no disponible para martin)
      if (prof.username !== "martin") {
        const btnToggle = document.createElement("button");
        btnToggle.type = "button";
        btnToggle.className = `btn ${prof.active ? "ghost" : "green"}`;
        btnToggle.style.color = prof.active ? "#dc2626" : "";
        btnToggle.textContent = prof.active ? "Dar de baja" : "Reactivar";
        btnToggle.addEventListener("click", () => handleToggleActive(prof));
        tdActions.append(btnToggle);
      }

      tr.append(tdName, tdEmail, tdPhone, tdRole, tdStatus, tdActions);
      return tr;
    })
  );
}

function openCreateModal() {
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

function openEditModal(prof) {
  currentEditingUser = prof;
  if (modalTitle) modalTitle.textContent = `Editar a ${prof.name}`;
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

function closeModal() {
  if (modalEl) modalEl.hidden = true;
  currentEditingUser = null;
}

async function handleSaveProfessional(e) {
  e.preventDefault();
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

  btnSaveModal.disabled = true;
  try {
    if (currentEditingUser) {
      // Modificar
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
      // Alta
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
    closeModal();
    await loadAdminData();
  } catch (err) {
    dialogAlert("Error al guardar: " + (err.message || "Error desconocido"));
  } finally {
    btnSaveModal.disabled = false;
  }
}

async function handleToggleActive(prof) {
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
    await loadAdminData();
  } catch (err) {
    dialogAlert("Error al cambiar estado: " + (err.message || "Error desconocido"));
  }
}

async function handleResendInvite(prof) {
  const ok = await dialogConfirm(
    `¿Reenviar enlace de configuración de contraseña a ${escapeHtml(prof.name)} (${escapeHtml(prof.email)})?`
  );
  if (!ok) return;

  try {
    const res = await api("profesionales.php", {
      method: "POST",
      body: JSON.stringify({
        action: "resend_invite",
        username: prof.username,
      }),
    });
    dialogAlert(res.message || "Enlace enviado exitosamente.");
  } catch (err) {
    dialogAlert("Error al reenviar enlace: " + (err.message || "Error desconocido"));
  }
}

export function initAdminModule() {
  btnNuevoProf?.addEventListener("click", openCreateModal);
  btnCloseModal?.addEventListener("click", closeModal);
  btnCancelModal?.addEventListener("click", closeModal);
  formEl?.addEventListener("submit", handleSaveProfessional);

  // Cerrar al hacer clic en el backdrop
  modalEl?.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      closeModal();
    }
  });

  // Tecla Escape para cerrar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl && !modalEl.hidden) {
      closeModal();
    }
  });
}
