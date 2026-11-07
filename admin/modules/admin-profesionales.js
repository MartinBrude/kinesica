/**
 * Kinésica Admin - Gestión de Profesionales del Equipo
 * Altas, bajas lógicas, edición de datos, roles (admin/profesional/colaborador),
 * reenvío de accesos y vista de detalle de usuario.
 */

import { api } from "./api.js?v=78";
import { escapeHtml, dialogAlert, dialogConfirm } from "./dom.js?v=79";
import { formatDisplayPhone } from "./phone-format.js";

// Modal Alta / Edición
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

// Modal Vista Detalle
const detailModalEl = document.querySelector("#admin-prof-detail-modal");
const detailCloseBtn = document.querySelector("#admin-prof-detail-close");
const detailModalCloseBtn = document.querySelector("#admin-prof-detail-modal-close");
const detailBtnEdit = document.querySelector("#admin-prof-detail-btn-edit");
const detailBtnInvite = document.querySelector("#admin-prof-detail-btn-invite");
const detailBtnToggle = document.querySelector("#admin-prof-detail-btn-toggle");

const detailAvatar = document.querySelector("#admin-prof-detail-avatar");
const detailName = document.querySelector("#admin-prof-detail-name");
const detailUsername = document.querySelector("#admin-prof-detail-username");
const detailRoleBadge = document.querySelector("#admin-prof-detail-role-badge");
const detailStatusBadge = document.querySelector("#admin-prof-detail-status-badge");
const detailEmail = document.querySelector("#admin-prof-detail-email");
const detailEmailLink = document.querySelector("#admin-prof-detail-email-link");
const detailCopyEmailBtn = document.querySelector("#admin-prof-detail-copy-email");
const detailPhone = document.querySelector("#admin-prof-detail-phone");
const detailPhoneLink = document.querySelector("#admin-prof-detail-phone-link");
const detailWaBtn = document.querySelector("#admin-prof-detail-wa-btn");
const detailRoleDesc = document.querySelector("#admin-prof-detail-role-desc");
const detailTotp = document.querySelector("#admin-prof-detail-totp");
const detailLogins = document.querySelector("#admin-prof-detail-logins");

let currentEditingUser = null;
let currentDetailUser = null;
let cachedProfesionales = [];
let reloadCallback = null;

/**
 * Obtiene las iniciales a partir del nombre para el avatar circular.
 */
export function getInitials(name) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Paleta de colores consistente y armónica para el avatar.
 */
export function getAvatarColor(username, name) {
  const map = {
    norberto: "linear-gradient(135deg, #0b2545, #1d4ed8)",
    maria: "linear-gradient(135deg, #047857, #10b981)",
    martin: "linear-gradient(135deg, #4338ca, #6366f1)",
    facundo: "linear-gradient(135deg, #b45309, #f59e0b)",
  };
  const u = String(username || "").toLowerCase();
  if (map[u]) return map[u];
  const list = [
    "linear-gradient(135deg, #0b2545, #1d4ed8)",
    "linear-gradient(135deg, #047857, #10b981)",
    "linear-gradient(135deg, #4338ca, #6366f1)",
    "linear-gradient(135deg, #b45309, #f59e0b)",
    "linear-gradient(135deg, #be185d, #ec4899)",
    "linear-gradient(135deg, #0e7490, #06b6d4)",
  ];
  let h = 0;
  const s = (username || name || "u").toLowerCase();
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return list[Math.abs(h) % list.length];
}

export function isProfModalOpen() {
  return (modalEl && !modalEl.hidden) || (detailModalEl && !detailModalEl.hidden);
}

export function closeProfModal() {
  if (modalEl) modalEl.hidden = true;
  if (detailModalEl) detailModalEl.hidden = true;
  currentEditingUser = null;
  currentDetailUser = null;
}

export function openCreateModal() {
  closeProfModal();
  currentEditingUser = null;
  if (modalTitle) modalTitle.textContent = "Nuevo usuario";
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
  closeProfModal();
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

/**
 * Abre la Vista Detalle completa donde se centraliza toda la información y acciones.
 */
export function openDetailModal(prof) {
  if (!detailModalEl) return;
  if (modalEl) modalEl.hidden = true;
  currentDetailUser = prof;

  const displayName = prof.name || prof.display_name || prof.username;
  const initials = getInitials(displayName);
  const avatarBg = getAvatarColor(prof.username, displayName);

  if (detailAvatar) {
    detailAvatar.textContent = initials;
    detailAvatar.style.background = avatarBg;
  }
  if (detailName) detailName.textContent = displayName;
  if (detailUsername) detailUsername.textContent = `@${prof.username}`;

  // Rol y Permisos
  let roleLabel = "Profesional";
  let roleClass = "professional";
  let roleDesc = "Cuenta de Profesional de la salud: acceso a historias clínicas, fichas de pacientes, turnera propia y visualización de recordatorios.";
  if (prof.role === "admin") {
    roleLabel = "Admin";
    roleClass = "admin";
    roleDesc = "Cuenta de Administrador con control total del sistema: gestión de usuarios, configuración del consultorio, registro de gastos, reportes y control del bot Clara.";
  } else if (prof.role === "colaborador") {
    roleLabel = "Colaborador";
    roleClass = "colaborador";
    roleDesc = "Cuenta de Colaborador: acceso de consulta y lectura a fichas y reportes sin facultades de edición ni administración.";
  }

  if (detailRoleBadge) {
    detailRoleBadge.className = `prof-role-badge ${roleClass}`;
    detailRoleBadge.textContent = roleLabel.toUpperCase();
  }
  if (detailRoleDesc) {
    detailRoleDesc.textContent = roleDesc;
  }

  // Estado
  if (detailStatusBadge) {
    detailStatusBadge.className = `prof-status-badge ${prof.active ? "active" : "inactive"}`;
    detailStatusBadge.innerHTML = `<span class="prof-status-dot"></span>${prof.active ? "Activo" : "Inactivo"}`;
  }

  // Email
  if (detailEmail) detailEmail.textContent = prof.email || "No registrado";
  if (detailEmailLink) {
    if (prof.email) {
      detailEmailLink.href = `mailto:${prof.email}`;
      detailEmailLink.style.pointerEvents = "auto";
      detailEmailLink.style.opacity = "1";
    } else {
      detailEmailLink.removeAttribute("href");
      detailEmailLink.style.pointerEvents = "none";
      detailEmailLink.style.opacity = "0.7";
    }
  }
  if (detailCopyEmailBtn) {
    detailCopyEmailBtn.hidden = !prof.email;
    detailCopyEmailBtn.onclick = (e) => {
      e.stopPropagation();
      if (prof.email) {
        navigator.clipboard?.writeText(prof.email).then(() => {
          const originalText = detailCopyEmailBtn.innerHTML;
          detailCopyEmailBtn.textContent = "¡Copiado!";
          setTimeout(() => { detailCopyEmailBtn.innerHTML = originalText; }, 1600);
        });
      }
    };
  }

  // Teléfono
  const formattedPhone = prof.telefono ? formatDisplayPhone(prof.telefono) : "";
  if (detailPhone) detailPhone.textContent = formattedPhone || "No registrado";
  if (detailPhoneLink) {
    if (prof.telefono) {
      detailPhoneLink.href = `tel:${prof.telefono}`;
      detailPhoneLink.style.pointerEvents = "auto";
      detailPhoneLink.style.opacity = "1";
    } else {
      detailPhoneLink.removeAttribute("href");
      detailPhoneLink.style.pointerEvents = "none";
      detailPhoneLink.style.opacity = "0.7";
    }
  }
  if (detailWaBtn) {
    const rawDigits = String(prof.telefono || "").replace(/\D/g, "");
    if (rawDigits.length >= 8) {
      detailWaBtn.hidden = false;
      detailWaBtn.href = `https://wa.me/${rawDigits}`;
    } else {
      detailWaBtn.hidden = true;
    }
  }

  // Seguridad: 2FA
  if (detailTotp) {
    if (prof.totp_confirmed) {
      detailTotp.innerHTML = `<span style="color:#059669; font-weight:600;">● Verificado y protegido con App Authenticator (2FA activo)</span>`;
    } else {
      detailTotp.innerHTML = `<span style="color:#d97706; font-weight:600;">⚠️ Pendiente de verificación (se configurará en el próximo ingreso)</span>`;
    }
  }

  // Historial de accesos
  if (detailLogins) {
    const count = prof.login_count || 0;
    detailLogins.textContent = `${count} ${count === 1 ? "inicio" : "inicios"} de sesión registrados`;
  }

  // Acciones en la Vista Detalle:
  // 1. Dar de baja / Reactivar
  if (detailBtnToggle) {
    if (prof.username === "martin") {
      detailBtnToggle.hidden = true;
    } else {
      detailBtnToggle.hidden = false;
      if (prof.active) {
        detailBtnToggle.className = "btn ghost btn-prof-toggle-danger";
        detailBtnToggle.textContent = "Dar de baja";
        detailBtnToggle.title = "Suspender temporalmente la cuenta del profesional";
      } else {
        detailBtnToggle.className = "btn ghost btn-prof-toggle-reactivate";
        detailBtnToggle.textContent = "Reactivar cuenta";
        detailBtnToggle.title = "Reactivar el acceso de la cuenta del profesional";
      }
    }
  }

  // 2. Enviar acceso
  if (detailBtnInvite) {
    detailBtnInvite.hidden = !prof.email;
  }

  detailModalEl.hidden = false;
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
    let updatedUser = null;
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
      updatedUser = res.user || {
        ...currentEditingUser,
        name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
        email,
        telefono,
        role,
      };
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
      dialogAlert(res.message || "Usuario dado de alta. Se envió el link a su correo.");
    }
    closeProfModal();
    if (typeof onReload === "function") await onReload();
    if (updatedUser) {
      openDetailModal(updatedUser);
    }
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
    : `¿Deseás dar de baja temporalmente a ${escapeHtml(prof.name)}? Su sesión quedará bloqueada y no podrá ingresar al sistema hasta que lo reactives.`;

  const ok = await dialogConfirm(msg);
  if (!ok) return;

  try {
    const res = await api("profesionales.php", {
      method: "POST",
      body: JSON.stringify({
        action: "toggle_active",
        username: prof.username,
        active: isActivating ? 1 : 0,
      }),
    });
    dialogAlert(res.message || (isActivating ? "Cuenta reactivada." : "Cuenta dada de baja."));
    prof.active = isActivating ? 1 : 0;
    if (typeof onReload === "function") await onReload();
    if (currentDetailUser && currentDetailUser.username === prof.username) {
      openDetailModal(prof);
    }
  } catch (err) {
    dialogAlert("Error al modificar estado: " + (err.message || "Error desconocido"));
  }
}

export async function handleResendInvite(prof) {
  const ok = await dialogConfirm(
    `¿Deseás reenviar el correo de acceso a ${escapeHtml(prof.name)} (${escapeHtml(prof.email)})? Recibirá un enlace seguro para crear su contraseña.`
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
    dialogAlert(res.message || "Se envió el correo de acceso.");
  } catch (err) {
    dialogAlert("Error al enviar el acceso: " + (err.message || "Error desconocido"));
  }
}

/**
 * Renderizado de tabla limpia: solo Profesional, Rol, Estado y botón Detalle.
 * Teléfono, email y acciones se gestionan exclusivamente en la Vista Detalle.
 */
export function renderProfesionales(profesionales, onReload) {
  if (!profTableBody) return;
  reloadCallback = onReload;
  profTableBody.replaceChildren(
    ...profesionales.map((prof) => {
      const tr = document.createElement("tr");
      if (!prof.active) tr.className = "is-inactive";
      tr.title = "Hacé clic en la fila para ver la ficha detallada";
      tr.addEventListener("click", () => openDetailModal(prof));

      // 1. Columna Profesional: Avatar con iniciales + Nombre + @username
      const tdName = document.createElement("td");
      const userCell = document.createElement("div");
      userCell.className = "prof-user-cell";

      const displayName = prof.name || prof.display_name || prof.username;
      const avatar = document.createElement("div");
      avatar.className = "prof-avatar";
      avatar.textContent = getInitials(displayName);
      avatar.style.background = getAvatarColor(prof.username, displayName);

      const userMeta = document.createElement("div");
      userMeta.className = "prof-user-meta";

      const nameStrong = document.createElement("strong");
      nameStrong.className = "prof-name";
      nameStrong.textContent = displayName;

      const userSub = document.createElement("span");
      userSub.className = "prof-username";
      userSub.textContent = `@${prof.username}`;

      userMeta.append(nameStrong, userSub);
      userCell.append(avatar, userMeta);
      tdName.append(userCell);

      // 2. Columna Rol
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

      // 3. Columna Estado con punto indicador visual
      const tdStatus = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = `prof-status-badge ${prof.active ? "active" : "inactive"}`;
      const statusDot = document.createElement("span");
      statusDot.className = "prof-status-dot";
      statusBadge.append(statusDot, document.createTextNode(prof.active ? "Activo" : "Inactivo"));
      tdStatus.append(statusBadge);

      // 4. Columna Ficha: Botón directo a Vista Detalle
      const tdActions = document.createElement("td");
      tdActions.className = "prof-actions-td";
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "prof-actions-cell";

      const btnDetail = document.createElement("button");
      btnDetail.type = "button";
      btnDetail.className = "btn btn-prof-detail";
      btnDetail.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Ver detalle
      `;
      btnDetail.title = "Ver ficha y datos del profesional";
      btnDetail.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetailModal(prof);
      });
      actionsWrap.append(btnDetail);

      tdActions.append(actionsWrap);
      tr.append(tdName, tdRole, tdStatus, tdActions);
      return tr;
    })
  );
}

export async function loadProfesionalesData(onReload) {
  try {
    reloadCallback = onReload;
    const tbody = document.getElementById("admin-prof-tbody");
    if (tbody && (!cachedProfesionales || !cachedProfesionales.length)) {
      tbody.innerHTML = `<tr><td colspan="4" class="admin-table-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Cargando equipo profesional…</span></td></tr>`;
    }
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
  reloadCallback = onReload;

  // Modal de Alta / Edición
  btnNuevoProf?.addEventListener("click", openCreateModal);
  btnCloseModal?.addEventListener("click", closeProfModal);
  btnCancelModal?.addEventListener("click", closeProfModal);
  formEl?.addEventListener("submit", (e) => handleSaveProfessional(e, onReload));
  modalEl?.addEventListener("click", (e) => {
    if (e.target === modalEl) closeProfModal();
  });

  // Modal de Detalle
  detailCloseBtn?.addEventListener("click", closeProfModal);
  detailModalCloseBtn?.addEventListener("click", closeProfModal);
  detailModalEl?.addEventListener("click", (e) => {
    if (e.target === detailModalEl) closeProfModal();
  });

  // Acciones dentro de la Vista Detalle:
  // 1. Editar
  detailBtnEdit?.addEventListener("click", () => {
    if (currentDetailUser) {
      openEditModal(currentDetailUser);
    }
  });

  // 2. Enviar acceso por email
  detailBtnInvite?.addEventListener("click", () => {
    if (currentDetailUser) {
      handleResendInvite(currentDetailUser);
    }
  });

  // 3. Dar de baja / Reactivar
  detailBtnToggle?.addEventListener("click", () => {
    if (currentDetailUser) {
      handleToggleActive(currentDetailUser, reloadCallback);
    }
  });
}
