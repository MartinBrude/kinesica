import { formatDisplayPhone } from "./phone-format.js";
import { getInitials, getAvatarColor } from "./admin-profesionales-avatar.js";
import {
  modalEl,
  detailModalEl,
  detailAvatar,
  detailName,
  detailUsername,
  detailRoleBadge,
  detailStatusBadge,
  detailEmail,
  detailEmailLink,
  detailCopyEmailBtn,
  detailPhone,
  detailPhoneLink,
  detailWaBtn,
  detailRoleDesc,
  detailTotp,
  detailLogins,
  detailBtnToggle,
  detailBtnInvite,
  setCurrentDetailUser,
  isSoleActiveAdmin,
} from "./admin-profesionales-state.js";

export function openDetailModal(prof) {
  if (!detailModalEl) return;
  if (modalEl) modalEl.hidden = true;
  setCurrentDetailUser(prof);

  const displayName = prof.name || prof.display_name || prof.username;
  const initials = getInitials(displayName);
  const avatarBg = getAvatarColor(prof.username, displayName);

  if (detailAvatar) {
    detailAvatar.textContent = initials;
    detailAvatar.style.background = avatarBg;
  }
  if (detailName) detailName.textContent = displayName;
  if (detailUsername) detailUsername.textContent = `@${prof.username}`;

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

  if (detailStatusBadge) {
    detailStatusBadge.className = `prof-status-badge ${prof.active ? "active" : "inactive"}`;
    detailStatusBadge.innerHTML = `<span class="prof-status-dot"></span>${prof.active ? "Activo" : "Inactivo"}`;
  }

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

  if (detailTotp) {
    if (prof.totp_confirmed) {
      detailTotp.innerHTML = `<span style="color:#059669; font-weight:600;">● Verificado y protegido con App Authenticator (2FA activo)</span>`;
    } else {
      detailTotp.innerHTML = `<span style="color:#d97706; font-weight:600;">⚠️ Pendiente de verificación (se configurará en el próximo ingreso)</span>`;
    }
  }

  if (detailLogins) {
    const count = prof.login_count || 0;
    detailLogins.textContent = `${count} ${count === 1 ? "inicio" : "inicios"} de sesión registrados`;
  }

  if (detailBtnToggle) {
    // Ocultar baja solo si es el último admin activo (protección por rol, no por nombre).
    if (isSoleActiveAdmin(prof)) {
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

  if (detailBtnInvite) {
    detailBtnInvite.hidden = !prof.email;
  }

  detailModalEl.hidden = false;
}
